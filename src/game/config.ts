export const CONFIG = Object.freeze({
  ruleVersion: 'phase1-foundation-v1',
  stepHz: 60,
  climbMmPerStep: 70,
  laneWidth: 2.4,
  laneChangeSteps: 10,
  jumpSteps: 48,
  slideSteps: 48,
  moduleHeight: 8,
  moduleCount: 18,
  modulesBelow: 3,
  maxCatchupSeconds: 0.25,
});
export type Quality = 'low' | 'medium' | 'high';
export const PIXEL_RATIO: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 };
