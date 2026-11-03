import {
  compareRecords,
  validateNickname,
  verifyRunReplay,
  type LeaderboardEntry,
  type RunSubmission,
  type WeeklyLeaderboardView,
} from '../src/game/replay';
import { getJstWeekId } from '../src/game/simulation';

export interface R2ObjectBodyLike {
  json<T>(): Promise<T>;
  httpEtag?: string;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export interface Env {
  RANKING_BUCKET: R2BucketLike;
}

interface StoredWeekDocument {
  weekId: string;
  updatedAtMs: number;
  processedRunIds: string[];
  records: Record<string, LeaderboardEntry>;
}

const rateLimitWindow = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientKey: string, nowMs: number): boolean {
  const current = rateLimitWindow.get(clientKey);
  if (!current || nowMs > current.resetAt) {
    rateLimitWindow.set(clientKey, { count: 1, resetAt: nowMs + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count++;
  return true;
}

function extractPlayerId(request: Request, fallbackId?: string): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)daiei_player_id=([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  const headerId = request.headers.get('X-Player-Id');
  if (headerId) return headerId;
  return fallbackId || `anon_${Date.now().toString(36)}`;
}

function buildView(doc: StoredWeekDocument, playerId?: string): WeeklyLeaderboardView {
  const allEntries = Object.values(doc.records);
  const publicSorted = allEntries.filter(e => e.isPublic && e.nickname).sort(compareRecords);
  const ranked = publicSorted.map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  let myRecord: (LeaderboardEntry & { rank: number | null }) | null = null;
  if (playerId && doc.records[playerId]) {
    const mine = doc.records[playerId];
    const pubIdx = ranked.findIndex(r => r.playerId === playerId);
    myRecord = { ...mine, rank: pubIdx >= 0 ? pubIdx + 1 : null };
  }

  return {
    weekId: doc.weekId,
    podium: ranked.slice(0, 3),
    top100: ranked.slice(0, 100),
    myRecord,
    totalPublicPlayers: ranked.length,
  };
}

async function loadWeekDoc(bucket: R2BucketLike, weekId: string): Promise<StoredWeekDocument> {
  const key = `daiei-tower-climb/rankings/${weekId}.json`;
  const existing = await bucket.get(key);
  if (!existing) {
    return { weekId, updatedAtMs: Date.now(), processedRunIds: [], records: {} };
  }
  return await existing.json<StoredWeekDocument>();
}

async function saveWeekDoc(bucket: R2BucketLike, doc: StoredWeekDocument): Promise<void> {
  const key = `daiei-tower-climb/rankings/${doc.weekId}.json`;
  doc.updatedAtMs = Date.now();
  await bucket.put(key, JSON.stringify(doc), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

function jsonResponse(body: unknown, status = 200, setPlayerIdCookie?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (setPlayerIdCookie) {
    headers['Set-Cookie'] = `daiei_player_id=${encodeURIComponent(setPlayerIdCookie)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const nowMs = Date.now();
    const playerId = extractPlayerId(request);

    if (!checkRateLimit(playerId, nowMs)) {
      return jsonResponse({ error: 'too_many_requests' }, 429);
    }

    if (request.method === 'GET' && url.pathname === '/api/ranking/weekly') {
      const weekId = url.searchParams.get('weekId') || getJstWeekId(nowMs);
      const doc = await loadWeekDoc(env.RANKING_BUCKET, weekId);
      return jsonResponse(buildView(doc, playerId), 200, playerId);
    }

    if (request.method === 'POST' && url.pathname === '/api/ranking/submit') {
      const body = (await request.json()) as RunSubmission;
      body.playerId = playerId;

      const verified = verifyRunReplay(body);
      if (!verified.valid) {
        return jsonResponse(
          { accepted: false, reason: verified.reason, updatedPersonalBest: false },
          400,
          playerId
        );
      }

      const doc = await loadWeekDoc(env.RANKING_BUCKET, body.courseId);
      if (doc.processedRunIds.includes(body.runId)) {
        return jsonResponse(
          {
            accepted: true,
            updatedPersonalBest: false,
            view: buildView(doc, playerId),
          },
          200,
          playerId
        );
      }

      doc.processedRunIds = [...doc.processedRunIds.slice(-4999), body.runId];
      const existing = doc.records[playerId];
      let nickname: string | null = existing?.nickname ?? null;
      if (body.nickname) {
        const check = validateNickname(body.nickname);
        if (check.valid) nickname = check.sanitized;
      }

      const candidate: LeaderboardEntry = {
        runId: body.runId,
        playerId,
        weekId: body.courseId,
        nickname,
        isPublic: Boolean(nickname),
        score: verified.score,
        altitudeMeters: verified.altitudeMeters,
        effectiveCoins: verified.effectiveCoins,
        coins: verified.coins,
        recordedAtMs: nowMs,
      };

      let updatedPersonalBest = false;
      if (!existing || compareRecords(candidate, existing) < 0) {
        doc.records[playerId] = candidate;
        updatedPersonalBest = true;
      } else if (nickname && !existing.isPublic) {
        existing.nickname = nickname;
        existing.isPublic = true;
      }

      await saveWeekDoc(env.RANKING_BUCKET, doc);
      return jsonResponse(
        {
          accepted: true,
          updatedPersonalBest,
          view: buildView(doc, playerId),
        },
        200,
        playerId
      );
    }

    if (request.method === 'POST' && url.pathname === '/api/ranking/nickname') {
      const body = (await request.json()) as { weekId?: string; nickname?: string };
      const weekId = body.weekId || getJstWeekId(nowMs);
      const check = validateNickname(body.nickname || '');
      if (!check.valid) {
        return jsonResponse({ ok: false, error: check.error }, 400, playerId);
      }

      const doc = await loadWeekDoc(env.RANKING_BUCKET, weekId);
      const record = doc.records[playerId];
      if (!record) {
        return jsonResponse({ ok: false, error: '対象の週間記録が見つかりません。' }, 404, playerId);
      }

      record.nickname = check.sanitized;
      record.isPublic = true;
      await saveWeekDoc(env.RANKING_BUCKET, doc);
      return jsonResponse({ ok: true, view: buildView(doc, playerId) }, 200, playerId);
    }

    return new Response('Not Found', { status: 404 });
  },
};
