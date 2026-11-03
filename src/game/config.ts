export const CONFIG = Object.freeze({
  ruleVersion: 'daiei-climb-v2-speed-items',
  stepHz: 60,
  legacyBaseClimbMmPerStep: 70, // Previous initial speed: 4.20 m/s (70mm * 60Hz)
  speedScalePermille: 1200, // +20% speed scale (1.20x)
  climbMmPerStep: 84, // Updated initial speed (+20%): 5.04 m/s (84mm * 60Hz)
  maxClimbMmPerStep: 156, // Updated max speed cap (+20%): 9.36 m/s (156mm * 60Hz)
  accelIntervalMm: 75_000, // Smooth acceleration every 75m (was 60m) to prevent sudden difficulty spikes
  accelAddMmPerStep: 6, // +0.36 m/s per 75m tier
  slowSpeedMultiplierPermille: 550, // 55% speed during slow-motion item
  laneWidth: 2.4,
  laneChangeSteps: 10, // ~0.167s at 60Hz
  jumpSteps: 48, // 0.8s at 60Hz
  highJumpSteps: 60, // 1.0s at 60Hz during high_jump
  slideSteps: 48, // 0.8s at 60Hz
  landSteps: 8, // Brief landing animation window
  itemDurationSteps: 600, // 10.0 seconds at 60Hz (600 steps)
  itemEarlyShowcaseRows: [1, 3, 5, 7] as const, // Guaranteed early appearance of all 4 items (12m, 36m, 60m, 84m)
  itemSpawnIntervalRows: 3, // Configurable item spawn interval after early showcase (every 3 rows = 36m)
  itemPickupEffectSteps: 36, // 0.6s pickup visual burst duration
  rowSpacingMm: 12_000, // 12m between obstacle/coin rows
  firstHazardRow: 2, // Start hazards at 24m
  collisionHalfDepthMm: 720, // +/- 0.72m collision window around row altitude
  laneHitThreshold: 0.78, // Horizontal collision threshold in meters
  magnetRadiusMeters: 5.2, // Covers all 3 lanes when magnet is active
  windStartAltitudeMm: 96_000, // Wind zones start appearing from 96m
  windPushIntervalSteps: 75, // Sustained wind nudges 1 lane every 1.25s unless countered
  moduleHeight: 8,
  moduleCount: 18,
  modulesBelow: 3,
  maxCatchupSeconds: 0.25,
  maxReplayTicks: 60 * 60 * 60, // 1 hour max replay validation window (216,000 ticks)
  maxReplayActions: 20_000,
});

export type Quality = 'low' | 'medium' | 'high';
export const PIXEL_RATIO: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 };
