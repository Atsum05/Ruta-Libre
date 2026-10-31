// External services sit behind these interfaces (ADR 0007). Adapters map each upstream to core
// types and validate its payload; tests use fakes, so CI needs no network or keys.

import type { InterpretResponse, PlacesResponse, Waypoint } from '@rutalibre/contract'
import type { Route, StatusSnapshot, TransitLeg, WalkLeg } from '@rutalibre/core'

export interface StatusProvider {
  /** Fetches and validates the latest statuses. Throws on any upstream or format problem. */
  snapshot(): Promise<StatusSnapshot>
}

/** [lng, lat] pairs. */
export type Path = readonly (readonly [number, number])[]

/** Core legs plus what the UI needs to draw and describe them. */
export interface DetailedWalkLeg extends WalkLeg {
  readonly path: Path
}

export interface DetailedTransitLeg extends TransitLeg {
  readonly label: string
  readonly color: string
  readonly textColor: string
  readonly stopCount: number | null
  /** Timetable departure from `from`, RFC 3339, when the provider gives one. */
  readonly departAt?: string
  /** Timetable arrival at `to`, RFC 3339, when the provider gives one. */
  readonly arriveAt?: string
  readonly path: Path
}

export interface DetailedRoute extends Route {
  readonly legs: readonly (DetailedWalkLeg | DetailedTransitLeg)[]
}

export interface RoutingRequest {
  readonly origin: Waypoint
  readonly destination: Waypoint
  readonly departAt?: string
  /**
   * Which vehicles the provider may use: any; Metro only (asked alongside "any", so Metro
   * options are always on the table, ADR 0014); or buses only, the last fallback.
   */
  readonly travel: 'any' | 'metro' | 'bus'
}

export interface RoutingProvider {
  /** Candidate routes, the provider's preferred one first. Empty when it finds none. */
  plan(request: RoutingRequest): Promise<DetailedRoute[]>
}

export interface PlacesProvider {
  search(query: string, session: string): Promise<PlacesResponse['suggestions']>
}

export interface LanguageProvider {
  interpret(text: string): Promise<InterpretResponse>
}
