import { CONFIG } from './config';
import {
  createPlayState,
  getCourseRow,
  step,
  type Action,
  type ReplayAction,
} from './simulation';

export interface RunSubmission {
  runId: string;
  playerId: string;
  courseId: string;
  ruleVersion: string;
  totalTicks: number;
  actions: ReplayAction[];
  claimedScore?: number;
  claimedAltitudeMeters?: number;
  claimedEffectiveCoins?: number;
  nickname?: string | null;
}

export interface VerifiedRunResult {
  valid: boolean;
  reason?: string;
  courseId: string;
  totalTicks: number;
  altitudeMm: number;
  altitudeMeters: number;
  coins: number;
  effectiveCoins: number;
  score: number;
  endedByGameOver: boolean;
}

export interface LeaderboardEntry {
  runId: string;
  playerId: string;
  weekId: string;
  nickname: string | null;
  isPublic: boolean;
  score: number;
  altitudeMeters: number;
  effectiveCoins: number;
  coins: number;
  recordedAtMs: number;
}

export interface WeeklyLeaderboardView {
  weekId: string;
  podium: (LeaderboardEntry & { rank: number })[];
  top100: (LeaderboardEntry & { rank: number })[];
  myRecord: (LeaderboardEntry & { rank: number | null }) | null;
  totalPublicPlayers: number;
}

const VALID_ACTIONS = new Set<Action>(['left', 'right', 'jump', 'slide']);

export function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[<>&"'`\\]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

export function validateNickname(raw: string): { valid: boolean; sanitized: string; error?: string } {
  const sanitized = sanitizeNickname(raw);
  if (sanitized.length < 1) {
    return { valid: false, sanitized, error: 'ニックネームを1〜12文字で入力してください。' };
  }
  if (Array.from(sanitized).length > 12) {
    return { valid: false, sanitized, error: 'ニックネームは12文字以内で入力してください。' };
  }
  return { valid: true, sanitized };
}

/**
 * Replays a submitted action log deterministically and computes the authoritative score.
 * Rejects tampered logs, invalid actions, out-of-order ticks, or actions after Game Over.
 */
export function verifyRunReplay(submission: RunSubmission): VerifiedRunResult {
  if (submission.ruleVersion !== CONFIG.ruleVersion) {
    return {
      valid: false,
      reason: ' invalid_rule_version',
      courseId: submission.courseId,
      totalTicks: 0,
      altitudeMm: 0,
      altitudeMeters: 0,
      coins: 0,
      effectiveCoins: 0,
      score: 0,
      endedByGameOver: false,
    };
  }

  if (
    !Number.isInteger(submission.totalTicks) ||
    submission.totalTicks <= 0 ||
    submission.totalTicks > CONFIG.maxReplayTicks
  ) {
    return {
      valid: false,
      reason: 'invalid_total_ticks',
      courseId: submission.courseId,
      totalTicks: 0,
      altitudeMm: 0,
      altitudeMeters: 0,
      coins: 0,
      effectiveCoins: 0,
      score: 0,
      endedByGameOver: false,
    };
  }

  if (!Array.isArray(submission.actions) || submission.actions.length > CONFIG.maxReplayActions) {
    return {
      valid: false,
      reason: 'invalid_actions_length',
      courseId: submission.courseId,
      totalTicks: 0,
      altitudeMm: 0,
      altitudeMeters: 0,
      coins: 0,
      effectiveCoins: 0,
      score: 0,
      endedByGameOver: false,
    };
  }

  const actionMap = new Map<number, Action[]>();
  let lastTick = 0;
  for (const item of submission.actions) {
    if (
      !item ||
      !Number.isInteger(item.tick) ||
      item.tick < 0 ||
      item.tick >= submission.totalTicks ||
      item.tick < lastTick ||
      !VALID_ACTIONS.has(item.action)
    ) {
      return {
        valid: false,
        reason: 'invalid_action_entry',
        courseId: submission.courseId,
        totalTicks: 0,
        altitudeMm: 0,
        altitudeMeters: 0,
        coins: 0,
        effectiveCoins: 0,
        score: 0,
        endedByGameOver: false,
      };
    }
    lastTick = item.tick;
    const bucket = actionMap.get(item.tick) ?? [];
    if (bucket.length >= 4) {
      return {
        valid: false,
        reason: 'too_many_actions_per_tick',
        courseId: submission.courseId,
        totalTicks: 0,
        altitudeMm: 0,
        altitudeMeters: 0,
        coins: 0,
        effectiveCoins: 0,
        score: 0,
        endedByGameOver: false,
      };
    }
    bucket.push(item.action);
    actionMap.set(item.tick, bucket);
  }

  const state = createPlayState(submission.courseId);
  for (let t = 0; t < submission.totalTicks; t++) {
    const tickActions = actionMap.get(t);
    if (state.status !== 'running') {
      if (tickActions && tickActions.length > 0) {
        return {
          valid: false,
          reason: 'action_after_gameover',
          courseId: submission.courseId,
          totalTicks: state.tick,
          altitudeMm: state.altitudeMm,
          altitudeMeters: Math.floor(state.altitudeMm / 1000),
          coins: state.coins,
          effectiveCoins: state.effectiveCoins,
          score: state.score,
          endedByGameOver: true,
        };
      }
      break;
    }
    step(state, tickActions);
  }

  return {
    valid: true,
    courseId: submission.courseId,
    totalTicks: state.tick,
    altitudeMm: state.altitudeMm,
    altitudeMeters: Math.floor(state.altitudeMm / 1000),
    coins: state.coins,
    effectiveCoins: state.effectiveCoins,
    score: state.score,
    endedByGameOver: state.status === 'gameover',
  };
}

/**
 * Generates a deterministic solvable run using the course's guaranteed safeLane & safeAction.
 * Used in automated tests to prove every course row is passable and produces a valid replay.
 */
export function buildAutoPilotRun(courseId: string, maxSteps: number): {
  actions: ReplayAction[];
  totalTicks: number;
  score: number;
  altitudeMeters: number;
  effectiveCoins: number;
} {
  const state = createPlayState(courseId);
  const actions: ReplayAction[] = [];

  for (let t = 0; t < maxSteps && state.status === 'running'; t++) {
    const nextRowIdx = Math.max(
      1,
      Math.floor((state.altitudeMm + CONFIG.rowSpacingMm - CONFIG.collisionHalfDepthMm - 300) / CONFIG.rowSpacingMm)
    );
    const nextRow = getCourseRow(state.courseSeed, nextRowIdx);
    const tickActions: Action[] = [];

    if (state.laneSteps === 0 && state.lane !== nextRow.safeLane) {
      const dir: Action = nextRow.safeLane < state.lane ? 'left' : 'right';
      tickActions.push(dir);
      actions.push({ tick: state.tick, action: dir });
    }

    const distToRowMm = nextRow.altitudeMm - state.altitudeMm;
    if (
      nextRow.safeAction !== 'none' &&
      (state.motion === 'climb' || state.motion === 'land') &&
      distToRowMm > 0 &&
      distToRowMm <= state.speedMmPerStep * 16
    ) {
      tickActions.push(nextRow.safeAction);
      actions.push({ tick: state.tick, action: nextRow.safeAction });
    }

    step(state, tickActions);
  }

  return {
    actions,
    totalTicks: state.tick,
    score: state.score,
    altitudeMeters: Math.floor(state.altitudeMm / 1000),
    effectiveCoins: state.effectiveCoins,
  };
}

export function compareRecords(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.altitudeMeters !== a.altitudeMeters) return b.altitudeMeters - a.altitudeMeters;
  if (b.effectiveCoins !== a.effectiveCoins) return b.effectiveCoins - a.effectiveCoins;
  return a.recordedAtMs - b.recordedAtMs;
}

export class WeeklyRankingEngine {
  private weeks = new Map<string, Map<string, LeaderboardEntry>>();
  private processedRunIds = new Set<string>();

  submitVerifiedRun(
    submission: RunSubmission,
    nowMs: number = Date.now()
  ): {
    accepted: boolean;
    reason?: string;
    verified?: VerifiedRunResult;
    updatedPersonalBest: boolean;
    entry?: LeaderboardEntry;
    view?: WeeklyLeaderboardView;
  } {
    const verified = verifyRunReplay(submission);
    if (!verified.valid) {
      return { accepted: false, reason: verified.reason, verified, updatedPersonalBest: false };
    }

    const weekId = submission.courseId;
    let weekMap = this.weeks.get(weekId);
    if (!weekMap) {
      weekMap = new Map();
      this.weeks.set(weekId, weekMap);
    }

    // Deduplicate identical runId retries
    if (this.processedRunIds.has(submission.runId)) {
      const existing = weekMap.get(submission.playerId);
      return {
        accepted: true,
        verified,
        updatedPersonalBest: false,
        entry: existing,
        view: this.getWeeklyView(weekId, submission.playerId),
      };
    }
    this.processedRunIds.add(submission.runId);

    const existing = weekMap.get(submission.playerId);
    let nickname: string | null = existing?.nickname ?? null;
    if (submission.nickname) {
      const check = validateNickname(submission.nickname);
      if (check.valid) nickname = check.sanitized;
    }

    const candidate: LeaderboardEntry = {
      runId: submission.runId,
      playerId: submission.playerId,
      weekId,
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
      weekMap.set(submission.playerId, candidate);
      updatedPersonalBest = true;
    } else if (nickname && !existing.isPublic) {
      existing.nickname = nickname;
      existing.isPublic = true;
    }

    return {
      accepted: true,
      verified,
      updatedPersonalBest,
      entry: weekMap.get(submission.playerId),
      view: this.getWeeklyView(weekId, submission.playerId),
    };
  }

  registerNickname(
    weekId: string,
    playerId: string,
    rawNickname: string
  ): { ok: boolean; error?: string; view?: WeeklyLeaderboardView } {
    const check = validateNickname(rawNickname);
    if (!check.valid) return { ok: false, error: check.error };

    const weekMap = this.weeks.get(weekId);
    const entry = weekMap?.get(playerId);
    if (!entry) {
      return { ok: false, error: '対象の週間記録が見つかりません。' };
    }

    entry.nickname = check.sanitized;
    entry.isPublic = true;
    return { ok: true, view: this.getWeeklyView(weekId, playerId) };
  }

  getWeeklyView(weekId: string, playerId?: string): WeeklyLeaderboardView {
    const weekMap = this.weeks.get(weekId);
    const allEntries = weekMap ? Array.from(weekMap.values()) : [];
    const publicSorted = allEntries.filter(e => e.isPublic && e.nickname).sort(compareRecords);

    const ranked = publicSorted.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    let myRecord: (LeaderboardEntry & { rank: number | null }) | null = null;
    if (playerId && weekMap?.has(playerId)) {
      const mine = weekMap.get(playerId)!;
      const publicIndex = ranked.findIndex(r => r.playerId === playerId);
      myRecord = {
        ...mine,
        rank: publicIndex >= 0 ? publicIndex + 1 : null,
      };
    }

    return {
      weekId,
      podium: ranked.slice(0, 3),
      top100: ranked.slice(0, 100),
      myRecord,
      totalPublicPlayers: ranked.length,
    };
  }
}
