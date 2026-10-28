import type { LatLng } from './geo.ts'

export interface TransitStop {
  readonly name: string
  readonly location: LatLng
}

export type TransitMode = 'metro' | 'bus' | 'rail'

export interface WalkLeg {
  readonly mode: 'walk'
  readonly durationSeconds: number
}

export interface TransitLeg {
  readonly mode: TransitMode
  readonly durationSeconds: number
  readonly line: string
  /** The sign on the vehicle, e.g. "Los Dominicos" or "La Cisterna (Ruta Roja)". */
  readonly headsign: string | null
  readonly from: TransitStop
  readonly to: TransitStop
}

export type Leg = WalkLeg | TransitLeg

/** One candidate trip from a routing provider, mapped to core types by its adapter. */
export interface Route {
  /** Total duration as the provider estimates it, including waits. */
  readonly durationSeconds: number
  readonly legs: readonly Leg[]
}
