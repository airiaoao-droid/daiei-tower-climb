import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { actionForKey, actionForSwipe, createState, FixedClock, moduleY, step, type Action } from '../src/game/simulation';
const running = () => ({ ...createState(), status: 'running' as const });
describe('Phase 1 deterministic climbing foundation', () => {
  it('climbs upwards at exactly 4.2 m/s without moving render origin', () => {
    const state = running(); for (let i = 0; i < 600; i++) step(state);
    expect(state.altitudeMm).toBe(42000); expect(state.tick).toBe(600);
  });
  it('does not advance ready or paused state, including input', () => {
    const state = createState(); const original = { ...state }; step(state, ['left']); expect(state).toEqual(original);
    state.status = 'paused'; const paused = { ...state }; step(state, ['jump']); expect(state).toEqual(paused);
  });
  it.each([30, 60, 90, 120, 144])('matches replay at %i rendering FPS', fps => {
    const state = running(); const clock = new FixedClock();
    const actions = new Map<number, Action[]>([[10, ['left']], [55, ['jump']], [60, ['right']], [100, ['slide']]]);
    for (let i = 0; i < fps * 10; i++) clock.advance(1 / fps, () => step(state, actions.get(state.tick)));
    const replay = running(); for (let i = 0; i < 600; i++) step(replay, actions.get(replay.tick));
    expect(state).toEqual(replay);
  });
  it('limits a long stall and discards fractional time when paused', () => {
    const clock = new FixedClock(); let count = 0;
    clock.advance(60, () => count++); expect(count).toBe(15);
    clock.advance(0.01, () => count++); clock.reset(); clock.advance(0.01, () => count++); expect(count).toBe(15);
  });
  it('moves smoothly in ten ticks, allows jump lane change, clamps edge lanes', () => {
    const state = running(); step(state, ['jump', 'left']); expect(state.x).toBeLessThan(0); expect(state.x).toBeGreaterThan(-2.4);
    for (let i = 0; i < 9; i++) step(state, ['left']); expect(state.lane).toBe(0); expect(state.x).toBe(-2.4); expect(state.motion).toBe('jump');
    for (let i = 0; i < 100; i++) step(state, ['left']); expect(state.lane).toBe(0);
    for (let i = 0; i < 100; i++) step(state, ['right']); expect(state.lane).toBe(2); expect(state.x).toBe(2.4);
  });
  it('uses a defined action duration and ignores conflicting motions', () => {
    const state = running(); step(state, ['jump', 'slide']); expect(state.motion).toBe('jump');
    for (let i = 1; i < CONFIG.jumpSteps; i++) step(state); expect(state.motion).toBe('climb');
    step(state, ['slide']); for (let i = 1; i < CONFIG.slideSteps; i++) step(state); expect(state.motion).toBe('climb');
  });
  it('keeps 18 contiguous pooled sections bounded even at extreme altitude', () => {
    for (const altitude of [0, 7.999, 8, 144, 10000, 1e9, 1e12 + 0.5]) {
      const ys = Array.from({ length: CONFIG.moduleCount }, (_, i) => moduleY(i, altitude)).sort((a, b) => a - b);
      expect(new Set(ys).size).toBe(18); expect(ys[0]).toBeGreaterThanOrEqual(-32); expect(ys.at(-1)!).toBeLessThanOrEqual(112);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(8);
    }
  });
  it('runs a six-hour simulation without creating additional world state', () => {
    const state = running(); const keys = Object.keys(state);
    for (let i = 0; i < 60 * 60 * 60 * 6; i++) step(state);
    expect(state.altitudeMm).toBe(90_720_000); expect(Object.keys(state)).toEqual(keys);
    expect(Number.isSafeInteger(state.altitudeMm)).toBe(true);
  });
  it('maps keyboard and swipe inputs and rejects small touch motions', () => {
    for (const key of ['ArrowLeft', 'a', 'A']) expect(actionForKey(key)).toBe('left');
    for (const key of ['ArrowRight', 'd', 'D']) expect(actionForKey(key)).toBe('right');
    for (const key of ['ArrowUp', 'w', 'W', ' ']) expect(actionForKey(key)).toBe('jump');
    for (const key of ['ArrowDown', 's', 'S']) expect(actionForKey(key)).toBe('slide');
    expect(actionForKey('x')).toBeUndefined(); expect(actionForSwipe(12, 12)).toBeUndefined();
    expect(actionForSwipe(-80, 10)).toBe('left'); expect(actionForSwipe(80, 10)).toBe('right');
    expect(actionForSwipe(10, -80)).toBe('jump'); expect(actionForSwipe(10, 80)).toBe('slide');
  });
  it('restarts with no leftover altitude, input state or animation', () => {
    const state = running(); step(state, ['jump', 'left']);
    const reset = createState(); expect(reset.altitudeMm).toBe(0); expect(reset.lane).toBe(1); expect(reset.motion).toBe('climb'); expect(reset.tick).toBe(0);
  });
});
