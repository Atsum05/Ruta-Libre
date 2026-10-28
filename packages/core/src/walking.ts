import type { Route } from './route.ts'

/**
 * Routing providers assume ~1.4 m/s; a person with reduced mobility walks at ~0.9 m/s, so a walk
 * takes ~1.5× as long. Only walking is scaled, never time on board (prototype lesson).
 */
export const WALKING_FACTOR = 1.5

export function adjustWalkingTime(seconds: number, factor: number = WALKING_FACTOR): number {
  if (!Number.isFinite(factor) || factor < 1) {
    throw new RangeError(`walking factor must be a finite number ≥ 1, got ${factor}`)
  }
  return Math.round(seconds * factor)
}

/** The provider's total duration, with each walking leg stretched to a reduced-mobility pace. */
export function adjustedDurationSeconds(route: Route, factor: number = WALKING_FACTOR): number {
  const walking = route.legs
    .filter((leg) => leg.mode === 'walk')
    .reduce((sum, leg) => sum + leg.durationSeconds, 0)
  return route.durationSeconds + adjustWalkingTime(walking, factor) - walking
}
