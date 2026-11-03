export const CONFIG = Object.freeze({
  ruleVersion: 'daiei-climb-v3-speed-items',
  stepHz: 60,
  legacyBaseClimbMmPerStep: 70, // Original initial speed: 4.20 m/s (70mm * 60Hz)
  previousClimbMmPerStep: 84, // Previous step (+20%): 5.04 m/s (84mm * 60Hz)
  speedScalePermille: 1440, // Further +20% speed scale (1.20 * 1.20 = 1.44x)
  climbMmPerStep: 101, // Further +20% initial speed: 6.06 m/s (101mm * 60Hz)
  maxClimbMmPerStep: 187, // Further +20% max speed cap: 11.22 m/s (187mm * 60Hz)
  accelIntervalMm: 85_000, // Smooth acceleration every 85m
  accelAddMmPerStep: 7, // +0.42 m/s per 85m tier
  slowSpeedMultiplierPermille: 550, // 55% speed during slow-motion item
  laneWidth: 2.4,
  laneChangeSteps: 10, // ~0.167s at 60Hz
  jumpSteps: 48, // 0.8s at 60Hz
  highJumpSteps: 60, // 1.0s at 60Hz during high_jump
  slideSteps: 48, // 0.8s at 60Hz
  landSteps: 8, // Brief landing animation window
  itemDurationSteps: 600, // 10.0 seconds at 60Hz (600 steps)
  itemEarlyShowcaseRows: [2, 8, 14, 20] as const, // Spaced out: 24m, 96m, 168m, 240m (every 72m)
  itemSpawnIntervalRows: 8, // Reduced frequency: every 8 rows (96m) after row 20
  itemPickupEffectSteps: 36, // 0.6s pickup visual burst duration
  rowSpacingMm: 12_000, // 12m between obstacle/coin rows
  firstHazardRow: 2, // Start hazards at 24m
  collisionHalfDepthMm: 820, // +/- 0.82m collision window around row altitude
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
