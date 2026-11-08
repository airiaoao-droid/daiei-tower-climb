import {
  WeeklyRankingEngine,
  type LeaderboardEntry,
  type RunSubmission,
  type WeeklyLeaderboardView,
} from '../game/replay';

const PLAYER_COOKIE = 'daiei_player_id';
const NICKNAME_KEY = 'daiei-climb.nickname.v1';
const LOCAL_RANK_KEY = 'daiei-climb.weekly-records.v1';

export function getOrCreatePlayerId(): string {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)daiei_player_id=([^;]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  let id = '';
  try {
    id = localStorage.getItem(PLAYER_COOKIE) || '';
  } catch {
    // Ignore storage error
  }
  if (!id) {
    id = `climber_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  try {
    localStorage.setItem(PLAYER_COOKIE, id);
  } catch {
    // Ignore storage error
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${PLAYER_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return id;
}

export function getSavedNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveNicknameLocally(nickname: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // Ignore storage error
  }
}

const localEngine = new WeeklyRankingEngine();
const loadedWeeks = new Set<string>();

function isDummyEntry(entry: LeaderboardEntry): boolean {
  return (
    entry.playerId.startsWith('npc_') ||
    entry.runId.startsWith('seed_')
  );
}

function ensureLocalWeekLoaded(weekId: string) {
  if (loadedWeeks.has(weekId)) return;
  loadedWeeks.add(weekId);

  const map = (localEngine as unknown as { weeks: Map<string, Map<string, LeaderboardEntry>> }).weeks;
  const weekMap = new Map<string, LeaderboardEntry>();

  try {
    const savedRaw = localStorage.getItem(`${LOCAL_RANK_KEY}:${weekId}`);
    if (savedRaw) {
      const savedEntries: LeaderboardEntry[] = JSON.parse(savedRaw);
      let hadDummy = false;
      for (const entry of savedEntries) {
        if (isDummyEntry(entry)) {
          hadDummy = true;
          continue;
        }
        weekMap.set(entry.playerId, entry);
      }
      map.set(weekId, weekMap);
      if (hadDummy) {
        localStorage.setItem(
          `${LOCAL_RANK_KEY}:${weekId}`,
          JSON.stringify(Array.from(weekMap.values()))
        );
      }
      return;
    }
  } catch {
    // Ignore parse errors
  }

  map.set(weekId, weekMap);
}

function persistLocalWeek(weekId: string) {
  try {
    const map = (localEngine as unknown as { weeks: Map<string, Map<string, LeaderboardEntry>> }).weeks;
    const weekMap = map.get(weekId);
    if (!weekMap) return;
    const realEntries = Array.from(weekMap.values()).filter(e => !isDummyEntry(e));
    localStorage.setItem(`${LOCAL_RANK_KEY}:${weekId}`, JSON.stringify(realEntries));
  } catch {
    // Ignore storage error
  }
}

export async function fetchWeeklyRanking(weekId: string, playerId: string): Promise<WeeklyLeaderboardView> {
  try {
    const res = await fetch(`/api/ranking/weekly?weekId=${encodeURIComponent(weekId)}`, {
      headers: { 'X-Player-Id': playerId },
    });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      return (await res.json()) as WeeklyLeaderboardView;
    }
  } catch {
    // Fall back to local engine when offline or in standalone Vite dev mode
  }
  ensureLocalWeekLoaded(weekId);
  return localEngine.getWeeklyView(weekId, playerId);
}

export async function submitRunRecord(submission: RunSubmission): Promise<{
  accepted: boolean;
  updatedPersonalBest: boolean;
  view: WeeklyLeaderboardView;
  reason?: string;
}> {
  try {
    const res = await fetch('/api/ranking/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Id': submission.playerId,
      },
      body: JSON.stringify(submission),
    });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      return await res.json();
    }
  } catch {
    // Fall back to local deterministic verification
  }

  ensureLocalWeekLoaded(submission.courseId);
  const result = localEngine.submitVerifiedRun(submission);
  persistLocalWeek(submission.courseId);
  return {
    accepted: result.accepted,
    updatedPersonalBest: result.updatedPersonalBest,
    view: result.view ?? localEngine.getWeeklyView(submission.courseId, submission.playerId),
    reason: result.reason,
  };
}

export async function registerPlayerNickname(
  weekId: string,
  playerId: string,
  nickname: string
): Promise<{ ok: boolean; error?: string; view?: WeeklyLeaderboardView }> {
  try {
    const res = await fetch('/api/ranking/nickname', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Id': playerId,
      },
      body: JSON.stringify({ weekId, playerId, nickname }),
    });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data.ok) saveNicknameLocally(nickname);
      return data;
    }
  } catch {
    // Fall back to local engine
  }

  ensureLocalWeekLoaded(weekId);
  const result = localEngine.registerNickname(weekId, playerId, nickname);
  if (result.ok) {
    saveNicknameLocally(nickname);
    persistLocalWeek(weekId);
  }
  return result;
}
