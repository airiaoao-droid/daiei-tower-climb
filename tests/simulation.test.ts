import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import {
  actionForKey,
  actionForSwipe,
  activateItem,
  collectCoin,
  computeScore,
  createPlayState,
  createState,
  FixedClock,
  getCourseRow,
  getJstWeekId,
  moduleY,
  seedFromCourseId,
  step,
  type Action,
} from '../src/game/simulation';
import {
  buildAutoPilotRun,
  validateNickname,
  verifyRunReplay,
  WeeklyRankingEngine,
} from '../src/game/replay';

const running = () => ({ ...createState(), status: 'running' as const });

describe('Phase 1-8 deterministic climbing, hazards, items, and ranking verification', () => {
  it('climbs upwards at 4.2 m/s initially without moving render origin', () => {
    const state = running();
    for (let i = 0; i < 600; i++) step(state);
    expect(state.altitudeMm).toBe(42000);
    expect(state.tick).toBe(600);
  });

  it('does not advance ready or paused state, including input and active item timers', () => {
    const state = createState();
    activateItem(state, 'magnet');
    const original = { ...state, items: { ...state.items } };
    step(state, ['left']);
    expect(state).toEqual(original);

    state.status = 'paused';
    const paused = { ...state, items: { ...state.items } };
    step(state, ['jump']);
    expect(state).toEqual(paused);
    expect(state.items.magnet).toBe(CONFIG.itemDurationSteps);
  });

  it.each([30, 60, 90, 120, 144])('matches replay at %i rendering FPS', fps => {
    const state = createPlayState('2026-11-02');
    const clock = new FixedClock();
    const actions = new Map<number, Action[]>([
      [10, ['left']],
      [55, ['jump']],
      [60, ['right']],
      [100, ['slide']],
    ]);
    for (let i = 0; i < fps * 5; i++) {
      clock.advance(1 / fps, () => step(state, actions.get(state.tick)));
    }
    const replay = createPlayState('2026-11-02');
    for (let i = 0; i < 300; i++) step(replay, actions.get(replay.tick));
    expect(state).toEqual(replay);
  });

  it('limits a long stall and discards fractional time when paused', () => {
    const clock = new FixedClock();
    let count = 0;
    clock.advance(60, () => count++);
    expect(count).toBe(15);
    clock.advance(0.01, () => count++);
    clock.reset();
    clock.advance(0.01, () => count++);
    expect(count).toBe(15);
  });

  it('moves smoothly in ten ticks, allows jump lane change, clamps edge lanes', () => {
    const state = running();
    step(state, ['jump', 'left']);
    expect(state.x).toBeLessThan(0);
    expect(state.x).toBeGreaterThan(-2.4);
    for (let i = 0; i < 9; i++) step(state, ['left']);
    expect(state.lane).toBe(0);
    expect(state.x).toBe(-2.4);
    expect(state.motion).toBe('jump');
    for (let i = 0; i < 100; i++) step(state, ['left']);
    expect(state.lane).toBe(0);
    for (let i = 0; i < 100; i++) step(state, ['right']);
    expect(state.lane).toBe(2);
    expect(state.x).toBe(2.4);
  });

  it('uses a defined action duration and ignores conflicting motions', () => {
    const state = running();
    step(state, ['jump', 'slide']);
    expect(state.motion).toBe('jump');
    for (let i = 1; i < CONFIG.jumpSteps; i++) step(state);
    expect(state.motion).toBe('climb');
    step(state, ['slide']);
    for (let i = 1; i < CONFIG.slideSteps; i++) step(state);
    expect(state.motion).toBe('climb');
  });

  it('keeps 18 contiguous pooled sections bounded even at extreme altitude', () => {
    for (const altitude of [0, 7.999, 8, 144, 10000, 1e9, 1e12 + 0.5]) {
      const ys = Array.from({ length: CONFIG.moduleCount }, (_, i) => moduleY(i, altitude)).sort(
        (a, b) => a - b
      );
      expect(new Set(ys).size).toBe(18);
      expect(ys[0]).toBeGreaterThanOrEqual(-32);
      expect(ys.at(-1)!).toBeLessThanOrEqual(112);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(8);
    }
  });

  it('runs a six-hour simulation without creating additional world state', () => {
    const state = running();
    const keys = Object.keys(state);
    for (let i = 0; i < 60 * 60 * 60 * 6; i++) step(state);
    expect(state.altitudeMm).toBe(90_720_000);
    expect(Object.keys(state)).toEqual(keys);
    expect(Number.isSafeInteger(state.altitudeMm)).toBe(true);
  });

  it('maps keyboard and swipe inputs and rejects small touch motions', () => {
    for (const key of ['ArrowLeft', 'a', 'A']) expect(actionForKey(key)).toBe('left');
    for (const key of ['ArrowRight', 'd', 'D']) expect(actionForKey(key)).toBe('right');
    for (const key of ['ArrowUp', 'w', 'W', ' ']) expect(actionForKey(key)).toBe('jump');
    for (const key of ['ArrowDown', 's', 'S']) expect(actionForKey(key)).toBe('slide');
    expect(actionForKey('x')).toBeUndefined();
    expect(actionForSwipe(12, 12)).toBeUndefined();
    expect(actionForSwipe(-80, 10)).toBe('left');
    expect(actionForSwipe(80, 10)).toBe('right');
    expect(actionForSwipe(10, -80)).toBe('jump');
    expect(actionForSwipe(10, 80)).toBe('slide');
  });

  it('calculates score as effective coins * integer altitude meters and prevents duplicate coin pickup', () => {
    expect(computeScore(50, 300_999)).toBe(15_000);
    const state = createPlayState('2026-11-02');
    // Row 1 has a coin on lane 1 at 12,000mm
    while (state.altitudeMm < 14_000 && state.status === 'running') {
      step(state);
    }
    expect(state.coins).toBe(1);
    expect(state.effectiveCoins).toBe(1);
  });

  it('runs all 4 special items for exactly 10 seconds (600 ticks), refreshes on re-pickup, and supports simultaneous items', () => {
    const state = running();
    activateItem(state, 'magnet');
    activateItem(state, 'double');
    activateItem(state, 'slow');
    activateItem(state, 'high_jump');
    expect(state.items.magnet).toBe(600);
    expect(state.items.double).toBe(600);

    // Double coin doubles effectiveCoins
    collectCoin(state, 1);
    expect(state.coins).toBe(1);
    expect(state.effectiveCoins).toBe(2);

    for (let i = 0; i < 300; i++) step(state);
    expect(state.items.magnet).toBe(300);

    // Re-activating refreshes to full 600 steps (10s)
    activateItem(state, 'magnet');
    expect(state.items.magnet).toBe(600);

    for (let i = 0; i < 600; i++) step(state);
    expect(state.items.magnet).toBe(0);
    expect(state.items.double).toBe(0);
    expect(state.items.slow).toBe(0);
    expect(state.items.high_jump).toBe(0);
  });

  it('accelerates with altitude and enforces the maximum climb speed cap', () => {
    const state = running();
    state.progressiveSpeed = true;
    state.altitudeMm = 10_000_000; // 10,000m
    step(state);
    expect(state.speedMmPerStep).toBe(CONFIG.maxClimbMmPerStep);
  });

  it('guarantees a solvable path across all stages and ends on obstacle collision when un-avoided', () => {
    const seed = seedFromCourseId('2026-11-02');
    for (let r = 1; r <= 80; r++) {
      const row = getCourseRow(seed, r);
      expect([0, 1, 2]).toContain(row.safeLane);
      const blockedOnSafe = row.obstacles.filter(o => o.lane === row.safeLane);
      if (blockedOnSafe.length > 0) {
        expect(['jump', 'slide']).toContain(row.safeAction);
      }
    }

    // Auto-pilot follows safeLane & safeAction to climb past 500m into space without dying
    const autoRun = buildAutoPilotRun('2026-11-02', 8500);
    expect(autoRun.altitudeMeters).toBeGreaterThan(500);
    expect(autoRun.score).toBeGreaterThan(0);

    // Standing still with no inputs eventually collides with an obstacle and triggers gameover
    const idleState = createPlayState('2026-11-02');
    for (let i = 0; i < 4000 && idleState.status === 'running'; i++) {
      step(idleState);
    }
    expect(idleState.status).toBe('gameover');
    expect(idleState.failReason).not.toBeNull();
  });

  it('switches weekly course IDs at exactly Monday 00:00 JST', () => {
    // 2026-11-01 23:59:59 JST = 2026-11-01T14:59:59Z (Sunday night in JST)
    const sunNightJst = Date.parse('2026-11-01T14:59:59Z');
    // 2026-11-02 00:00:00 JST = 2026-11-01T15:00:00Z (Monday 00:00 in JST)
    const monZeroJst = Date.parse('2026-11-01T15:00:00Z');
    expect(getJstWeekId(sunNightJst)).toBe('2026-10-26');
    expect(getJstWeekId(monZeroJst)).toBe('2026-11-02');
  });

  it('verifies replays on the server, ignores tampered scores, deduplicates runs, and manages top 100 & provisional records', () => {
    const courseId = '2026-11-02';
    const run = buildAutoPilotRun(courseId, 1800);

    // Server recalculates score and ignores tampered claimedScore
    const engine = new WeeklyRankingEngine();
    const res1 = engine.submitVerifiedRun(
      {
        runId: 'run-p1-1',
        playerId: 'player-1',
        courseId,
        ruleVersion: CONFIG.ruleVersion,
        totalTicks: run.totalTicks,
        actions: run.actions,
        claimedScore: 999_999_999,
        nickname: null, // Unregistered nickname -> provisional private record
      },
      1000
    );

    expect(res1.accepted).toBe(true);
    expect(res1.entry?.score).toBe(run.score);
    expect(res1.entry?.isPublic).toBe(false);
    expect(res1.view?.top100.length).toBe(0);
    expect(res1.view?.myRecord?.score).toBe(run.score);

    // Duplicate runId submission does not duplicate
    const dup = engine.submitVerifiedRun(
      {
        runId: 'run-p1-1',
        playerId: 'player-1',
        courseId,
        ruleVersion: CONFIG.ruleVersion,
        totalTicks: run.totalTicks,
        actions: run.actions,
      },
      1005
    );
    expect(dup.accepted).toBe(true);
    expect(dup.updatedPersonalBest).toBe(false);

    // Registering nickname makes the record public on the podium
    const nickRes = engine.registerNickname(courseId, 'player-1', '<b>恒一</b>');
    expect(nickRes.ok).toBe(true);
    expect(nickRes.view?.podium[0].nickname).toBe('b恒一/b');
    expect(nickRes.view?.myRecord?.rank).toBe(1);

    // Rejects invalid/out-of-order action history
    const invalidReplay = verifyRunReplay({
      runId: 'bad-1',
      playerId: 'player-2',
      courseId,
      ruleVersion: CONFIG.ruleVersion,
      totalTicks: 200,
      actions: [
        { tick: 50, action: 'left' },
        { tick: 10, action: 'right' },
      ],
    });
    expect(invalidReplay.valid).toBe(false);
    expect( validateNickname('').valid ).toBe(false);
  });
});
