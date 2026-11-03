export const CONFIG = Object.freeze({
  ruleVersion: 'daiei-climb-v1',
  stepHz: 60,
  climbMmPerStep: 70, // Initial speed: 4.2 m/s (70mm * 60Hz)
  maxClimbMmPerStep: 130, // Max speed cap: 7.8 m/s (130mm * 60Hz)
  accelIntervalMm: 60_000, // Accelerate every 60m
  accelAddMmPerStep: 6, // +0.36 m/s per 60m
  slowSpeedMultiplierPermille: 550, // 55% speed during slow-motion item
  laneWidth: 2.4,
  laneChangeSteps: 10, // ~0.167s at 60Hz
  jumpSteps: 48, // 0.8s at 60Hz
  highJumpSteps: 60, // 1.0s at 60Hz during high_jump
  slideSteps: 48, // 0.8s at 60Hz
  landSteps: 8, // Brief landing animation window
  itemDurationSteps: 600, // 10.0 seconds at 60Hz (600 steps)
  rowSpacingMm: 12_000, // 12m between obstacle/coin rows
  firstHazardRow: 2, // Start hazards at 24m
  collisionHalfDepthMm: 650, // +/- 0.65m collision window around row altitude
  laneHitThreshold: 0.78, // Horizontal collision threshold in meters
  magnetRadiusMeters: 5.2, // Covers all 3 lanes when magnet is active
  windStartAltitudeMm: 80_000, // Wind zones start appearing from 80m
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
