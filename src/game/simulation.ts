import { CONFIG } from './config';

export type Action = 'left' | 'right' | 'jump' | 'slide';
export type Status = 'ready' | 'running' | 'paused' | 'gameover';
export type Motion = 'climb' | 'jump' | 'slide' | 'land' | 'hit';
export type ObstacleType = 'beam_low' | 'beam_high' | 'missing_foothold' | 'moving_load';
export type ItemType = 'magnet' | 'double' | 'slow' | 'high_jump';
export type WindDirection = -1 | 0 | 1;
export type GameEvent = 'coin' | 'item' | 'jump' | 'land' | 'lane' | 'gameover';

export interface ReplayAction {
  tick: number;
  action: Action;
}

export interface LaneObstacle {
  lane: 0 | 1 | 2;
  type: Exclude<ObstacleType, 'moving_load'>;
}

export interface MovingLoadObstacle {
  type: 'moving_load';
  centerLane: 0 | 1 | 2;
  amplitudeMeters: number;
  periodTicks: number;
  phaseTicks: number;
  safeLane: 0 | 1 | 2;
}

export interface CourseCoin {
  id: number;
  lane: 0 | 1 | 2;
  offsetMm: number;
}

export interface CourseItem {
  id: number;
  lane: 0 | 1 | 2;
  type: ItemType;
  offsetMm: number;
}

export interface CourseRow {
  rowIndex: number;
  altitudeMm: number;
  safeLane: 0 | 1 | 2;
  safeAction: 'none' | 'jump' | 'slide';
  obstacles: LaneObstacle[];
  movingLoad: MovingLoadObstacle | null;
  coins: CourseCoin[];
  item: CourseItem | null;
  windDirection: WindDirection;
}

export interface ActiveItems {
  magnet: number;
  double: number;
  slow: number;
  high_jump: number;
}

export interface GameState {
  status: Status;
  tick: number;
  altitudeMm: number;
  lane: number;
  fromX: number;
  x: number;
  laneSteps: number;
  motion: Motion;
  motionSteps: number;
  courseId: string;
  courseSeed: number;
  hazardsEnabled: boolean;
  progressiveSpeed: boolean;
  coins: number;
  effectiveCoins: number;
  score: number;
  speedMmPerStep: number;
  items: ActiveItems;
  lastPickedItem: ItemType | null;
  pickupEffectSteps: number;
  windDirection: WindDirection;
  windWarningDirection: WindDirection;
  windExposureSteps: number;
  lastProcessedRow: number;
  collectedMask: number;
  failReason: ObstacleType | null;
  lastEvent: GameEvent | null;
}

export interface CreateStateOptions {
  courseId?: string;
  hazardsEnabled?: boolean;
  progressiveSpeed?: boolean;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const ITEM_TYPES: readonly ItemType[] = ['magnet', 'double', 'slow', 'high_jump'];

/**
 * Returns the weekly course ID anchored to Monday 00:00:00 JST (UTC+9).
 * Format: "YYYY-MM-DD" of the Monday starting that JST week.
 */
export function getJstWeekId(nowMs: number = Date.now()): string {
  const jstMs = nowMs + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);
  const utcDay = jstDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysSinceMonday = (utcDay + 6) % 7;
  const mondayJstMs = jstMs - daysSinceMonday * DAY_MS;
  const monday = new Date(mondayJstMs);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seedFromCourseId(courseId: string): number {
  let h = 2166136261 >>> 0;
  const input = `${CONFIG.ruleVersion}:${courseId}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hashRow(seed: number, rowIndex: number, salt: number): number {
  let x = (seed ^ Math.imul(rowIndex + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

export function laneToX(lane: number): number {
  return (lane - 1) * CONFIG.laneWidth;
}

export function movingLoadX(load: MovingLoadObstacle, tick: number): number {
  const center = laneToX(load.centerLane);
  const phase = ((tick + load.phaseTicks) % load.periodTicks) / load.periodTicks;
  return center + Math.sin(phase * Math.PI * 2) * load.amplitudeMeters;
}

/**
 * Computes a side-to-side weaving safe lane sequence that:
 * 1. Guides beginners gently in rows 1-5 (1 -> 1 -> 2 -> 1 -> 0)
 * 2. Actively alternates left/center/right in higher rows so the player never stays idle in one lane
 * 3. Frequently passes through or visits the center lane (lane 1)
 */
function computeWeavingSafeLane(courseSeed: number, rowIndex: number): 0 | 1 | 2 {
  if (rowIndex <= 2) return 1;
  if (rowIndex === 3) return 2;
  if (rowIndex === 4) return 1;
  if (rowIndex === 5) return 0;

  // Deterministic 8-step weaving cycle per chunk so consecutive rows always change lanes
  // while visiting center lane (1) and alternating left (0) / right (2)
  const cycles: readonly (readonly (0 | 1 | 2)[])[] = [
    [1, 0, 1, 2, 0, 1, 2, 1],
    [1, 2, 1, 0, 2, 1, 0, 1],
    [1, 0, 2, 1, 0, 2, 1, 2],
    [1, 2, 0, 1, 2, 0, 1, 0],
  ];
  const chunkIdx = Math.floor(rowIndex / 8);
  const stepInChunk = rowIndex % 8;
  const cycle = cycles[hashRow(courseSeed, chunkIdx, 1) % cycles.length];
  return cycle[stepInChunk];
}

function determineRowItem(courseSeed: number, rowIndex: number, safeLane: 0 | 1 | 2): CourseItem | null {
  if (rowIndex <= 0) return null;

  // Early showcase rows (2, 8, 14, 20 -> 24m, 96m, 168m, 240m) guarantee all 4 item types appear in order
  const earlyIndex = CONFIG.itemEarlyShowcaseRows.indexOf(
    rowIndex as (typeof CONFIG.itemEarlyShowcaseRows)[number]
  );
  if (earlyIndex !== -1) {
    // Prefer center lane if safeLane is center, or place at -3000mm on safeLane so it's 100% reachable
    return {
      id: rowIndex * 100 + 99,
      lane: safeLane,
      type: ITEM_TYPES[earlyIndex % ITEM_TYPES.length],
      offsetMm: -2800,
    };
  }

  // Subsequent rows: spawn according to configurable interval CONFIG.itemSpawnIntervalRows (every 8 rows = 96m)
  const lastEarlyRow = CONFIG.itemEarlyShowcaseRows[CONFIG.itemEarlyShowcaseRows.length - 1] ?? 0;
  const interval = Math.max(1, CONFIG.itemSpawnIntervalRows);
  if (rowIndex > lastEarlyRow && (rowIndex - lastEarlyRow) % interval === 0) {
    const itemType = ITEM_TYPES[hashRow(courseSeed, rowIndex, 13) % ITEM_TYPES.length];
    return {
      id: rowIndex * 100 + 99,
      lane: safeLane,
      type: itemType,
      offsetMm: -2800,
    };
  }

  return null;
}

/**
 * Deterministically generates a course row with a guaranteed solvable path,
 * increased center-lane coins/items, and side-to-side weaving layout.
 */
export function getCourseRow(courseSeed: number, rowIndex: number): CourseRow {
  const altitudeMm = rowIndex * CONFIG.rowSpacingMm;
  const safeLane = computeWeavingSafeLane(courseSeed, rowIndex);
  const prevSafeLane = rowIndex > 0 ? computeWeavingSafeLane(courseSeed, rowIndex - 1) : 1;

  const windActive =
    altitudeMm >= CONFIG.windStartAltitudeMm && hashRow(courseSeed, Math.floor(rowIndex / 3), 9) % 3 === 0;
  const windDirection: WindDirection = windActive
    ? hashRow(courseSeed, Math.floor(rowIndex / 3), 10) % 2 === 0
      ? -1
      : 1
    : 0;

  if (rowIndex < CONFIG.firstHazardRow) {
    return {
      rowIndex,
      altitudeMm,
      safeLane: 1,
      safeAction: 'none',
      obstacles: [],
      movingLoad: null,
      coins:
        rowIndex === 0
          ? []
          : [
              { id: rowIndex * 10 + 1, lane: 1, offsetMm: -2400 },
              { id: rowIndex * 10 + 2, lane: 1, offsetMm: 0 },
              { id: rowIndex * 10 + 3, lane: 1, offsetMm: 2400 },
            ],
      item: determineRowItem(courseSeed, rowIndex, 1),
      windDirection: 0,
    };
  }

  const difficultyTier = Math.min(5, Math.floor(altitudeMm / 96_000));
  const obstacles: LaneObstacle[] = [];
  let movingLoad: MovingLoadObstacle | null = null;
  let safeAction: 'none' | 'jump' | 'slide' = 'none';

  // Early onboarding rows (rows 2 to 5): teach lane change, jump, and slide step-by-step
  if (rowIndex <= CONFIG.earlyTutorialEndRow) {
    if (rowIndex === 2) {
      obstacles.push({ lane: 0, type: 'beam_low' });
    } else if (rowIndex === 3) {
      obstacles.push({ lane: 1, type: 'missing_foothold' });
    } else if (rowIndex === 4) {
      safeAction = 'jump';
      obstacles.push({ lane: 1, type: 'beam_low' }, { lane: 0, type: 'missing_foothold' });
    } else if (rowIndex === 5) {
      safeAction = 'slide';
      obstacles.push({ lane: 0, type: 'beam_high' }, { lane: 1, type: 'beam_low' });
    }
  } else {
    const pattern = hashRow(courseSeed, rowIndex, 2) % 10;

    if (pattern <= 2) {
      // Moving load row: sweeps across two lanes while leaving safeLane clear
      if (safeLane !== 1) {
        const centerLane: 0 | 1 | 2 = safeLane === 0 ? 2 : 0;
        movingLoad = {
          type: 'moving_load',
          centerLane,
          amplitudeMeters: 1.35,
          periodTicks: Math.max(68, 128 - difficultyTier * 10),
          phaseTicks: hashRow(courseSeed, rowIndex, 3) % 120,
          safeLane,
        };
      } else {
        // Safe lane is center (1): block outer lanes and optionally require jump/slide in center
        obstacles.push({ lane: 0, type: 'beam_low' }, { lane: 2, type: 'beam_high' });
        if ((hashRow(courseSeed, rowIndex, 4) % 1000) < CONFIG.actionObstacleChancePermille) {
          safeAction = hashRow(courseSeed, rowIndex, 5) % 2 === 0 ? 'jump' : 'slide';
          obstacles.push({ lane: 1, type: safeAction === 'jump' ? 'beam_low' : 'beam_high' });
        }
      }
    } else {
      // Static obstacles: always block prevSafeLane if it differs from safeLane, forcing lateral weaving!
      const safeRequiresAction =
        (hashRow(courseSeed, rowIndex, 4) % 1000) <
        CONFIG.actionObstacleChancePermille + difficultyTier * 45;
      if (safeRequiresAction) {
        const actionType = hashRow(courseSeed, rowIndex, 5) % 2 === 0 ? 'beam_low' : 'beam_high';
        safeAction = actionType === 'beam_low' ? 'jump' : 'slide';
        obstacles.push({ lane: safeLane, type: actionType });
      }

      const otherLanes = ([0, 1, 2] as const).filter(l => l !== safeLane);
      // Prioritize blocking prevSafeLane first so the player must move sideways
      otherLanes.sort((a, b) => (a === prevSafeLane ? -1 : b === prevSafeLane ? 1 : 0));

      const multiBlockThreshold = Math.min(
        CONFIG.obstacleDensityMaxPermille,
        CONFIG.obstacleDensityBasePermille + difficultyTier * 80
      );
      const hazardCount =
        (hashRow(courseSeed, rowIndex, 6) % 1000) < multiBlockThreshold ? 2 : 1;
      const types: Exclude<ObstacleType, 'moving_load'>[] = [
        'beam_low',
        'beam_high',
        'missing_foothold',
      ];

      for (let i = 0; i < hazardCount; i++) {
        const lane = otherLanes[i];
        const tIndex = hashRow(courseSeed, rowIndex, 7 + i) % types.length;
        obstacles.push({ lane, type: types[tIndex] });
      }
    }
  }

  // Build coins with strong center-lane presence and weaving trail
  const coins: CourseCoin[] = [
    // Primary coin on safeLane at the row altitude
    { id: rowIndex * 10 + safeLane, lane: safeLane, offsetMm: 0 },
  ];

  // Add center-lane coin between rows (at +3800mm ahead of the obstacle) so center lane is always rich in coins
  if ((hashRow(courseSeed, rowIndex, 11) % 1000) < CONFIG.centerCoinBiasPermille) {
    coins.push({ id: rowIndex * 10 + 4, lane: 1, offsetMm: 3800 });
  }

  // Add weaving guide coin on safeLane or opposite lane before the obstacle
  const leadLane: 0 | 1 | 2 = safeLane === 1 ? prevSafeLane : 1;
  if (hashRow(courseSeed, rowIndex, 12) % 2 === 0) {
    coins.push({ id: rowIndex * 10 + 7, lane: leadLane, offsetMm: -3800 });
  }

  const item = determineRowItem(courseSeed, rowIndex, safeLane);

  return {
    rowIndex,
    altitudeMm,
    safeLane,
    safeAction,
    obstacles,
    movingLoad,
    coins,
    item,
    windDirection,
  };
}

export function computeScore(effectiveCoins: number, altitudeMm: number): number {
  const coins = Math.max(0, Math.floor(effectiveCoins));
  const altitudeMeters = Math.max(0, Math.floor(altitudeMm / 1000));
  if (coins === 0 || altitudeMeters === 0) return 0;
  const raw = coins * altitudeMeters;
  if (!Number.isFinite(raw) || raw > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  return raw;
}

export function computeClimbSpeedMm(altitudeMm: number, progressive: boolean, slowTicks: number): number {
  let base: number = CONFIG.climbMmPerStep;
  if (progressive) {
    const tiers = Math.floor(Math.max(0, altitudeMm) / CONFIG.accelIntervalMm);
    base = Math.min(CONFIG.maxClimbMmPerStep, CONFIG.climbMmPerStep + tiers * CONFIG.accelAddMmPerStep);
  }
  if (slowTicks > 0) {
    return Math.max(42, Math.floor((base * CONFIG.slowSpeedMultiplierPermille) / 1000));
  }
  return base;
}

export function createState(options?: CreateStateOptions): GameState {
  const courseId = options?.courseId ?? getJstWeekId();
  const hazardsEnabled = options?.hazardsEnabled ?? false;
  const progressiveSpeed = options?.progressiveSpeed ?? hazardsEnabled;
  return {
    status: 'ready',
    tick: 0,
    altitudeMm: 0,
    lane: 1,
    fromX: 0,
    x: 0,
    laneSteps: 0,
    motion: 'climb',
    motionSteps: 0,
    courseId,
    courseSeed: seedFromCourseId(courseId),
    hazardsEnabled,
    progressiveSpeed,
    coins: 0,
    effectiveCoins: 0,
    score: 0,
    speedMmPerStep: CONFIG.climbMmPerStep,
    items: { magnet: 0, double: 0, slow: 0, high_jump: 0 },
    lastPickedItem: null,
    pickupEffectSteps: 0,
    windDirection: 0,
    windWarningDirection: 0,
    windExposureSteps: 0,
    lastProcessedRow: -1,
    collectedMask: 0,
    failReason: null,
    lastEvent: null,
  };
}

export function createPlayState(courseId: string = getJstWeekId()): GameState {
  return {
    ...createState({ courseId, hazardsEnabled: true, progressiveSpeed: true }),
    status: 'running',
  };
}

export function activateItem(state: GameState, type: ItemType) {
  state.items[type] = CONFIG.itemDurationSteps;
  state.lastPickedItem = type;
  state.pickupEffectSteps = CONFIG.itemPickupEffectSteps;
  state.lastEvent = 'item';
}

export function collectCoin(state: GameState, count = 1) {
  const gained = Math.max(1, Math.floor(count));
  const multiplier = state.items.double > 0 ? 2 : 1;
  state.coins += gained;
  state.effectiveCoins += gained * multiplier;
  state.score = computeScore(state.effectiveCoins, state.altitudeMm);
  state.lastEvent = 'coin';
}

export function applyAction(state: GameState, action: Action) {
  if (state.status !== 'running') return;
  if (action === 'left' || action === 'right') {
    if (state.laneSteps > 0) return;
    const target = Math.max(0, Math.min(2, state.lane + (action === 'left' ? -1 : 1)));
    if (target === state.lane) return;
    state.fromX = state.x;
    state.lane = target;
    state.laneSteps = CONFIG.laneChangeSteps;
    state.windExposureSteps = 0;
    state.lastEvent = 'lane';
  } else if (state.motion === 'climb' || state.motion === 'land') {
    state.motion = action;
    state.motionSteps =
      action === 'jump'
        ? state.items.high_jump > 0
          ? CONFIG.highJumpSteps
          : CONFIG.jumpSteps
        : CONFIG.slideSteps;
    if (action === 'jump') state.lastEvent = 'jump';
  }
}

function evaluateRowInteractions(state: GameState) {
  const currentRowIdx = Math.round(state.altitudeMm / CONFIG.rowSpacingMm);
  if (currentRowIdx !== state.lastProcessedRow) {
    state.lastProcessedRow = currentRowIdx;
    state.collectedMask = 0;
  }

  const row = getCourseRow(state.courseSeed, currentRowIdx);
  const nextRow = getCourseRow(state.courseSeed, currentRowIdx + 1);
  state.windDirection = row.windDirection;
  state.windWarningDirection = row.windDirection !== 0 ? row.windDirection : nextRow.windDirection;

  // Wind drift effect: nudges player 1 lane if exposed without counter-steering (leaves reaction time before row center)
  if (state.windDirection !== 0 && Math.abs(state.altitudeMm - row.altitudeMm) > 3000) {
    state.windExposureSteps++;
    if (state.windExposureSteps >= CONFIG.windPushIntervalSteps && state.laneSteps === 0) {
      state.windExposureSteps = 0;
      const pushedLane = Math.max(0, Math.min(2, state.lane + state.windDirection));
      if (pushedLane !== state.lane) {
        state.fromX = state.x;
        state.lane = pushedLane;
        state.laneSteps = CONFIG.laneChangeSteps;
      }
    }
  } else if (state.windDirection === 0) {
    state.windExposureSteps = 0;
  }

  // Check item pickup
  if (row.item && (state.collectedMask & 1) === 0) {
    const itemAlt = row.altitudeMm + row.item.offsetMm;
    if (Math.abs(state.altitudeMm - itemAlt) <= CONFIG.collisionHalfDepthMm * 1.45) {
      const itemX = laneToX(row.item.lane);
      if (Math.abs(state.x - itemX) <= CONFIG.laneHitThreshold * 1.2) {
        state.collectedMask |= 1;
        activateItem(state, row.item.type);
      }
    }
  }

  // Check coin pickups (with magnet attraction support)
  const pickupRadius = state.items.magnet > 0 ? CONFIG.magnetRadiusMeters : CONFIG.laneHitThreshold * 1.1;
  row.coins.forEach((coin, idx) => {
    const bit = 1 << (idx + 1);
    if ((state.collectedMask & bit) !== 0) return;
    const coinAlt = row.altitudeMm + coin.offsetMm;
    if (Math.abs(state.altitudeMm - coinAlt) <= CONFIG.collisionHalfDepthMm * 1.4) {
      const coinX = laneToX(coin.lane);
      if (Math.abs(state.x - coinX) <= pickupRadius) {
        state.collectedMask |= bit;
        collectCoin(state, 1);
      }
    }
  });

  // Check obstacle collisions around the row center altitude
  if (Math.abs(state.altitudeMm - row.altitudeMm) <= CONFIG.collisionHalfDepthMm) {
    const jumping = state.motion === 'jump';
    const sliding = state.motion === 'slide';
    const highJumping = jumping && state.items.high_jump > 0;

    for (const obs of row.obstacles) {
      const obsX = laneToX(obs.lane);
      if (Math.abs(state.x - obsX) <= CONFIG.laneHitThreshold) {
        const avoided =
          (obs.type === 'beam_low' && jumping) ||
          (obs.type === 'beam_high' && (sliding || highJumping)) ||
          (obs.type === 'missing_foothold' && jumping);
        if (!avoided) {
          state.status = 'gameover';
          state.motion = 'hit';
          state.failReason = obs.type;
          state.lastEvent = 'gameover';
          return;
        }
      }
    }

    if (row.movingLoad) {
      const loadX = movingLoadX(row.movingLoad, state.tick);
      if (Math.abs(state.x - loadX) <= CONFIG.laneHitThreshold * 0.95 && !highJumping) {
        state.status = 'gameover';
        state.motion = 'hit';
        state.failReason = 'moving_load';
        state.lastEvent = 'gameover';
        return;
      }
    }
  }
}

export function step(state: GameState, actions: readonly Action[] = []) {
  if (state.status !== 'running') return;
  state.lastEvent = null;
  for (const action of actions) applyAction(state, action);

  const climbStep = computeClimbSpeedMm(state.altitudeMm, state.progressiveSpeed, state.items.slow);
  state.speedMmPerStep = climbStep;
  state.tick++;
  state.altitudeMm += climbStep;

  if (state.laneSteps > 0) {
    state.laneSteps--;
    const t = 1 - state.laneSteps / CONFIG.laneChangeSteps;
    state.x = state.fromX + ((state.lane - 1) * CONFIG.laneWidth - state.fromX) * t * t * (3 - 2 * t);
  }

  if (state.motionSteps > 0 && --state.motionSteps === 0) {
    if (state.motion === 'jump' && state.hazardsEnabled) {
      state.motion = 'land';
      state.motionSteps = CONFIG.landSteps;
      state.lastEvent = 'land';
    } else {
      state.motion = 'climb';
    }
  }

  // Decrement active item timers
  for (const key of ITEM_TYPES) {
    if (state.items[key] > 0) {
      state.items[key]--;
    }
  }

  if (state.pickupEffectSteps > 0) {
    state.pickupEffectSteps--;
    if (state.pickupEffectSteps === 0) {
      state.lastPickedItem = null;
    }
  }

  if (state.hazardsEnabled) {
    evaluateRowInteractions(state);
  }

  state.score = computeScore(state.effectiveCoins, state.altitudeMm);
}

// Fixed-step accumulator: render rate never enters the game rules.
// Time above 250ms is intentionally discarded, preventing a catch-up jump after a stall.
export class FixedClock {
  private accumulated = 0;
  advance(seconds: number, update: () => void) {
    this.accumulated += Math.max(0, Math.min(CONFIG.maxCatchupSeconds, seconds));
    let count = 0;
    while (this.accumulated + 1e-10 >= 1 / CONFIG.stepHz) {
      update();
      this.accumulated -= 1 / CONFIG.stepHz;
      count++;
    }
    return count;
  }
  reset() {
    this.accumulated = 0;
  }
}

// Render coordinates remain small regardless of logical altitude.
export function moduleY(slot: number, altitudeMeters: number) {
  const current = Math.floor(altitudeMeters / CONFIG.moduleHeight);
  const first = current - CONFIG.modulesBelow;
  const section = first + (((slot - first) % CONFIG.moduleCount) + CONFIG.moduleCount) % CONFIG.moduleCount;
  return (section - current) * CONFIG.moduleHeight - (altitudeMeters % CONFIG.moduleHeight);
}

export function actionForKey(key: string): Action | undefined {
  return (
    {
      ArrowLeft: 'left',
      a: 'left',
      ArrowRight: 'right',
      d: 'right',
      ArrowUp: 'jump',
      w: 'jump',
      ' ': 'jump',
      ArrowDown: 'slide',
      s: 'slide',
    } as Record<string, Action>
  )[key.length === 1 ? key.toLowerCase() : key];
}

export function actionForSwipe(
  dx: number,
  dy: number,
  minDistance: number = CONFIG.swipeMinDistancePx
): Action | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < minDistance) return undefined;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'jump' : 'slide';
}
