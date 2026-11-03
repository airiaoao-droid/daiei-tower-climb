import { CONFIG } from './config';
export type Action = 'left' | 'right' | 'jump' | 'slide';
export type Status = 'ready' | 'running' | 'paused';
export type Motion = 'climb' | 'jump' | 'slide';
export interface GameState {
  status: Status; tick: number; altitudeMm: number; lane: number;
  fromX: number; x: number; laneSteps: number; motion: Motion; motionSteps: number;
}
export function createState(): GameState {
  return { status: 'ready', tick: 0, altitudeMm: 0, lane: 1, fromX: 0, x: 0, laneSteps: 0, motion: 'climb', motionSteps: 0 };
}
export function applyAction(state: GameState, action: Action) {
  if (state.status !== 'running') return;
  if (action === 'left' || action === 'right') {
    if (state.laneSteps > 0) return;
    const target = Math.max(0, Math.min(2, state.lane + (action === 'left' ? -1 : 1)));
    if (target === state.lane) return;
    state.fromX = state.x; state.lane = target; state.laneSteps = CONFIG.laneChangeSteps;
  } else if (state.motion === 'climb') {
    state.motion = action;
    state.motionSteps = action === 'jump' ? CONFIG.jumpSteps : CONFIG.slideSteps;
  }
}
export function step(state: GameState, actions: readonly Action[] = []) {
  if (state.status !== 'running') return;
  for (const action of actions) applyAction(state, action);
  state.tick++;
  state.altitudeMm += CONFIG.climbMmPerStep;
  if (state.laneSteps > 0) {
    state.laneSteps--;
    const t = 1 - state.laneSteps / CONFIG.laneChangeSteps;
    state.x = state.fromX + ((state.lane - 1) * CONFIG.laneWidth - state.fromX) * t * t * (3 - 2 * t);
  }
  if (state.motionSteps > 0 && --state.motionSteps === 0) state.motion = 'climb';
}
// Fixed-step accumulator: render rate never enters the game rules.
// Time above 250ms is intentionally discarded, preventing a catch-up jump after a stall.
export class FixedClock {
  private accumulated = 0;
  advance(seconds: number, update: () => void) {
    this.accumulated += Math.max(0, Math.min(CONFIG.maxCatchupSeconds, seconds));
    let count = 0;
    while (this.accumulated + 1e-10 >= 1 / CONFIG.stepHz) {
      update(); this.accumulated -= 1 / CONFIG.stepHz; count++;
    }
    return count;
  }
  reset() { this.accumulated = 0; }
}
// Render coordinates remain small regardless of logical altitude.
export function moduleY(slot: number, altitudeMeters: number) {
  const current = Math.floor(altitudeMeters / CONFIG.moduleHeight);
  const first = current - CONFIG.modulesBelow;
  const section = first + ((slot - first) % CONFIG.moduleCount + CONFIG.moduleCount) % CONFIG.moduleCount;
  return (section - current) * CONFIG.moduleHeight - (altitudeMeters % CONFIG.moduleHeight);
}
export function actionForKey(key: string): Action | undefined {
  return ({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', ArrowDown: 'slide', s: 'slide' } as Record<string, Action>)[key.length === 1 ? key.toLowerCase() : key];
}
export function actionForSwipe(dx: number, dy: number): Action | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'jump' : 'slide';
}
