import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import {
  actionForKey,
  actionForSwipe,
  activateItem,
  collectCoin,
  computeClimbSpeedMm,
  computeScore,
  createPlayState,
  createState,
  FixedClock,
  getCourseRow,
  getJstWeekId,
  ITEM_TYPES,
  moduleY,
  seedFromCourseId,
  step,
  type Action,
  type ItemType,
} from '../src/game/simulation';
import {
  buildAutoPilotRun,
  validateNickname,
  verifyRunReplay,
  WeeklyRankingEngine,
} from '../src/game/replay';

const running = () => ({ ...createState(), status: 'running' as const });

describe('Daiei Tower Climb: +20% speed update, 4 special items, and deterministic ranking verification', () => {
  it('increases initial climb speed by a further 20% (to 101 mm/step = 6.06 m/s) without moving render origin', () => {
    expect(CONFIG.legacyBaseClimbMmPerStep).toBe(70);
    expect(CONFIG.previousClimbMmPerStep).toBe(84);
    expect(CONFIG.climbMmPerStep).toBe(101); // +20% over 84
    const state = running();
    for (let i = 0; i < 600; i++) step(state);
    expect(state.altitudeMm).toBe(60_600); // 60.6m in 10s (6.06 m/s)
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

  it.each([30, 60, 90, 120, 144])('matches replay at %i rendering FPS regardless of frame rate', fps => {
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
    expect(state.altitudeMm).toBe(CONFIG.climbMmPerStep * 60 * 60 * 60 * 6);
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

  it('spawns all 4 special items in early rows on collectible safe lanes and allows actual pickup during play', () => {
    const seed = seedFromCourseId('2026-11-02');
    const earlyItems = CONFIG.itemEarlyShowcaseRows.map(r => getCourseRow(seed, r).item);
    expect(earlyItems.map(item => item?.type)).toEqual(['magnet', 'double', 'slow', 'high_jump']);
    for (const r of CONFIG.itemEarlyShowcaseRows) {
      const row = getCourseRow(seed, r);
      expect(row.item?.lane).toBe(row.safeLane);
    }

    // Play through the first 250m following safeLane and verify all 4 items are actually collected
    const state = createPlayState('2026-11-02');
    const picked = new Set<ItemType>();
    for (let t = 0; t < 4500 && state.altitudeMm < 250_000 && state.status === 'running'; t++) {
      const nextRowIdx = Math.max(
        1,
        Math.floor((state.altitudeMm + CONFIG.rowSpacingMm - CONFIG.collisionHalfDepthMm - 300) / CONFIG.rowSpacingMm)
      );
      const nextRow = getCourseRow(state.courseSeed, nextRowIdx);
      const actions: Action[] = [];
      if (state.laneSteps === 0 && state.lane !== nextRow.safeLane) {
        actions.push(nextRow.safeLane < state.lane ? 'left' : 'right');
      }
      const dist = nextRow.altitudeMm - state.altitudeMm;
      if (
        nextRow.safeAction !== 'none' &&
        (state.motion === 'climb' || state.motion === 'land') &&
        dist > 0 &&
        dist <= state.speedMmPerStep * 16
      ) {
        actions.push(nextRow.safeAction);
      }
      step(state, actions);
      if (state.lastEvent === 'item' && state.lastPickedItem) {
        picked.add(state.lastPickedItem);
      }
    }
    expect(picked).toEqual(new Set<ItemType>(ITEM_TYPES));
  });

  it('verifies each of the 4 special item effects, 5s duration, re-pickup refresh, and 2x coin score calculation', () => {
    expect(computeScore(50, 300_999)).toBe(15_000);
    const state = running();

    // 1. Magnet & 2. Double coin
    activateItem(state, 'magnet');
    activateItem(state, 'double');
    expect(state.items.magnet).toBe(300);
    expect(state.items.double).toBe(300);
    expect(state.pickupEffectSteps).toBe(CONFIG.itemPickupEffectSteps);

    collectCoin(state, 1);
    expect(state.coins).toBe(1);
    expect(state.effectiveCoins).toBe(2); // Doubled!

    // 3. Slow motion reduces step speed deterministically
    const normalSpeed = computeClimbSpeedMm(state.altitudeMm, true, 0);
    activateItem(state, 'slow');
    const slowSpeed = computeClimbSpeedMm(state.altitudeMm, true, state.items.slow);
    expect(slowSpeed).toBeLessThan(normalSpeed);

    // 4. High jump extends jump duration to CONFIG.highJumpSteps
    activateItem(state, 'high_jump');
    step(state, ['jump']);
    expect(state.motion).toBe('jump');
    expect(state.motionSteps).toBe(CONFIG.highJumpSteps - 1);

    // Advance 149 more steps (total 150 steps = 2.5s)
    for (let i = 0; i < 149; i++) step(state);
    expect(state.items.magnet).toBe(150);

    // Re-activating refreshes timer back to 300 steps (5.0s)
    activateItem(state, 'magnet');
    expect(state.items.magnet).toBe(300);

    // Advance 300 steps (5.0s) -> all items expire and return to normal state
    for (let i = 0; i < 300; i++) step(state);
    expect(state.items.magnet).toBe(0);
    expect(state.items.double).toBe(0);
    expect(state.items.slow).toBe(0);
    expect(state.items.high_jump).toBe(0);
    expect(state.speedMmPerStep).toBe(CONFIG.climbMmPerStep);
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
    const sunNightJst = Date.parse('2026-11-01T14:59:59Z');
    const monZeroJst = Date.parse('2026-11-01T15:00:00Z');
    expect(getJstWeekId(sunNightJst)).toBe('2026-10-26');
    expect(getJstWeekId(monZeroJst)).toBe('2026-11-02');
  });

  it('verifies replays on the server (including item effects), ignores tampered scores, and manages top 100 & provisional records', () => {
    const courseId = '2026-11-02';
    const run = buildAutoPilotRun(courseId, 1800);

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
        nickname: null,
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
    expect(validateNickname('').valid).toBe(false);
  });
});
