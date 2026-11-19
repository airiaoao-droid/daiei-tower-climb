import { compareRecords, validateNickname, verifyRunReplay, type LeaderboardEntry, type RunSubmission, type WeeklyLeaderboardView } from '../src/game/replay';
import { CONFIG } from '../src/game/config';
import { getJstWeekId } from '../src/game/simulation';

export interface R2ObjectBodyLike { json<T>(): Promise<T>; httpEtag: string; }
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(key: string, value: string, options: { onlyIf: Headers; httpMetadata: { contentType: string } }): Promise<unknown | null>;
}
export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}
export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}
export interface Env {
  RANKING_STORE?: DurableObjectNamespaceLike;
  RANKING_BUCKET?: R2BucketLike;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
interface StoredWeek { weekId: string; ruleVersion: string; records: Record<string, LeaderboardEntry>; updatedAtMs: number; }
class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const COOKIE = 'daiei_session_v2';
const limits = new Map<string, { count: number; until: number }>();
const MAX_BODY = 1_500_000;

function weekKey(week: string) { return `daiei-tower-climb/rankings/${CONFIG.ruleVersion}/${week}.json`; }
function weekId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || getJstWeekId(Date.parse(value)) !== value) throw new ApiError(400, 'invalid_week');
  return value;
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) throw new ApiError(413, 'request_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_json');
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'request_too_large'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { const body = JSON.parse(new TextDecoder().decode(bytes)); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body; }
  catch { throw new ApiError(400, 'invalid_json'); }
}
async function identity(request: Request) {
  const cookieRaw = request.headers.get('Cookie')?.match(/(?:^|;\s*)daiei_session_v2=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const headerRaw = request.headers.get('X-Player-Id')?.trim();
  const validUuid = cookieRaw && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(cookieRaw) ? cookieRaw : null;
  const session = validUuid ?? crypto.randomUUID();
  // Use cookie session when available; if cookies are blocked on mobile webview, fall back to sanitized X-Player-Id header
  const seedToken = validUuid ?? (headerRaw && /^[a-zA-Z0-9_-]{8,80}$/.test(headerRaw) ? headerRaw : session);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seedToken));
  const playerId = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return { playerId, cookie: `${COOKIE}=${session}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` };
}
function respond(body: unknown, status = 200, cookie?: string) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
function rateLimit(key: string) {
  const now = Date.now();
  for (const [id, value] of limits) if (value.until <= now) limits.delete(id);
  const value = limits.get(key);
  if (value && value.count >= 60) throw new ApiError(429, 'too_many_requests');
  if (!value) { if (limits.size >= 10000) limits.delete(limits.keys().next().value!); limits.set(key, { count: 1, until: now + 60000 }); } else value.count++;
}
function buildView(doc: StoredWeek, playerId: string): WeeklyLeaderboardView {
  const ranked = Object.values(doc.records).filter(e => e.isPublic && e.nickname).sort((a,b) => compareRecords(a,b) || a.playerId.localeCompare(b.playerId)).map((e,i) => ({ ...e, rank: i + 1 }));
  const mine = doc.records[playerId];
  return { weekId: doc.weekId, podium: ranked.slice(0,3), top100: ranked.slice(0,100), totalPublicPlayers: ranked.length, myRecord: mine ? { ...mine, rank: ranked.find(e => e.playerId === playerId)?.rank ?? null } : null };
}
async function readWeek(bucket: R2BucketLike, week: string) {
  const object = await bucket.get(weekKey(week));
  const doc: StoredWeek = object ? await object.json<StoredWeek>() : { weekId: week, ruleVersion: CONFIG.ruleVersion, records: {}, updatedAtMs: Date.now() };
  return { doc, etag: object?.httpEtag };
}
// Compare-and-swap: a second device/isolate cannot overwrite a concurrent best.
async function updateWeek(bucket: R2BucketLike, week: string, apply: (doc: StoredWeek) => boolean) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { doc, etag } = await readWeek(bucket, week);
    const changed = apply(doc);
    if (!changed) return { doc, changed: false };
    doc.updatedAtMs = Date.now();
    const onlyIf = new Headers(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' });
    const saved = await bucket.put(weekKey(week), JSON.stringify(doc), { onlyIf, httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    if (saved !== null) return { doc, changed: true };
  }
  throw new ApiError(503, 'ranking_busy_retry');
}
async function updateWeekInStorage(env: Env, week: string, apply: (doc: StoredWeek) => boolean): Promise<{ doc: StoredWeek; changed: boolean }> {
  if (env.RANKING_STORE) {
    const stub = env.RANKING_STORE.get(env.RANKING_STORE.idFromName(weekKey(week)));
    const getRes = await stub.fetch('https://ranking-store/doc');
    const doc: StoredWeek = getRes.ok
      ? ((await getRes.json()) as StoredWeek)
      : { weekId: week, ruleVersion: CONFIG.ruleVersion, records: {}, updatedAtMs: Date.now() };
    const changed = apply(doc);
    if (!changed) return { doc, changed: false };
    doc.updatedAtMs = Date.now();
    await stub.fetch('https://ranking-store/doc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    return { doc, changed: true };
  }
  if (env.RANKING_BUCKET) {
    return updateWeek(env.RANKING_BUCKET, week, apply);
  }
  throw new ApiError(503, 'ranking_storage_unavailable');
}

async function readWeekFromStorage(env: Env, week: string): Promise<StoredWeek> {
  if (env.RANKING_STORE) {
    const stub = env.RANKING_STORE.get(env.RANKING_STORE.idFromName(weekKey(week)));
    const getRes = await stub.fetch('https://ranking-store/doc');
    if (getRes.ok) {
      return (await getRes.json()) as StoredWeek;
    }
    return { weekId: week, ruleVersion: CONFIG.ruleVersion, records: {}, updatedAtMs: Date.now() };
  }
  if (env.RANKING_BUCKET) {
    return (await readWeek(env.RANKING_BUCKET, week)).doc;
  }
  throw new ApiError(503, 'ranking_storage_unavailable');
}

export class RankingStore {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const doc = await this.state.storage.get<StoredWeek>('doc');
      if (!doc) return new Response('Not Found', { status: 404 });
      return new Response(JSON.stringify(doc), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    if (request.method === 'PUT') {
      const doc = (await request.json()) as StoredWeek;
      await this.state.storage.put('doc', doc);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not Found', { status: 404 });
    let cookie: string | undefined;
    try {
      if (!env.RANKING_STORE && !env.RANKING_BUCKET) throw new ApiError(503, 'ranking_storage_unavailable');
      if (request.method !== 'GET' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) throw new ApiError(403, 'invalid_origin');
      const id = await identity(request); cookie = id.cookie;
      rateLimit(request.headers.get('CF-Connecting-IP') ?? id.playerId);
      if (request.method === 'GET' && url.pathname === '/api/ranking/weekly') {
        const week = weekId(url.searchParams.get('weekId') ?? getJstWeekId());
        return respond(buildView(await readWeekFromStorage(env, week), id.playerId), 200, cookie);
      }
      if (request.method === 'POST' && url.pathname === '/api/ranking/submit') {
        const body = await readBody(request);
        const week = weekId(body.courseId);
        if (typeof body.runId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.runId)) throw new ApiError(400, 'invalid_run_id');
        const submission = { ...body, playerId: id.playerId } as unknown as RunSubmission;
        const verified = verifyRunReplay(submission);
        if (!verified.valid) throw new ApiError(400, verified.reason?.trim() ?? 'invalid_replay');
        if (!verified.endedByGameOver || verified.totalTicks !== body.totalTicks) throw new ApiError(400, 'incomplete_replay');
        const nick = typeof body.nickname === 'string' ? validateNickname(body.nickname) : null;
        const { doc, changed } = await updateWeekInStorage(env, week, doc => {
          const existing = doc.records[id.playerId];
          const nickname = existing?.nickname ?? (nick?.valid ? nick.sanitized : null);
          const candidate: LeaderboardEntry = { runId: submission.runId, playerId: id.playerId, weekId: week, nickname, isPublic: !!nickname, score: verified.score, altitudeMeters: verified.altitudeMeters, effectiveCoins: verified.effectiveCoins, coins: verified.coins, recordedAtMs: Date.now() };
          if (existing) {
            if (existing.runId === candidate.runId || compareRecords(candidate, existing) >= 0) {
              if (nickname && (!existing.isPublic || existing.nickname !== nickname)) {
                existing.nickname = nickname;
                existing.isPublic = true;
                return true;
              }
              return false;
            }
          }
          doc.records[id.playerId] = candidate; return true;
        });
        return respond({ accepted: true, updatedPersonalBest: changed, view: buildView(doc, id.playerId) }, 200, cookie);
      }
      if (request.method === 'POST' && url.pathname === '/api/ranking/nickname') {
        const body = await readBody(request); const week = weekId(body.weekId ?? getJstWeekId());
        const nick = validateNickname(typeof body.nickname === 'string' ? body.nickname : '');
        if (!nick.valid) throw new ApiError(400, nick.error ?? 'invalid_nickname');
        const { doc } = await updateWeekInStorage(env, week, doc => {
          const entry = doc.records[id.playerId]; if (!entry) throw new ApiError(404, 'record_not_found');
          if (entry.nickname === nick.sanitized && entry.isPublic) return false;
          entry.nickname = nick.sanitized; entry.isPublic = true; return true;
        });
        return respond({ ok: true, view: buildView(doc, id.playerId) }, 200, cookie);
      }
      return respond({ error: 'not_found' }, 404, cookie);
    } catch (error) {
      return respond({ accepted: false, ok: false, error: error instanceof ApiError ? error.message : 'ranking_service_unavailable' }, error instanceof ApiError ? error.status : 503, cookie);
    }
  },
};
