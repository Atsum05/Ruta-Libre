// The single source of truth for what crosses HTTP between web and API (ADR 0013). The API
// validates requests with these schemas; the web client validates responses with them; the
// OpenAPI document is generated from them. Types are inferred, never written by hand.

import { z } from 'zod'

// --- Shared pieces ------------------------------------------------------------------------------

const Lat = z.number().min(-90).max(90)
const Lng = z.number().min(-180).max(180)

/** [lng, lat], as decoded from the provider's polyline. */
export const PathSchema = z.array(z.tuple([Lng, Lat]))

export const VerdictKindSchema = z.enum(['ok', 'warning', 'blocked', 'unknown'])
export const StatusHealthSchema = z.enum(['ok', 'stale', 'degraded', 'unavailable'])
export const DeviceStateSchema = z.enum(['working', 'out-of-service'])

/** Mirrors core's `Reason`; a compile-time check in contract.test.ts keeps them in step. */
export const ReasonSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('status-unavailable') }),
  z.object({ code: z.literal('status-stale'), ageMs: z.number() }),
  z.object({ code: z.literal('stop-unmatched'), stopName: z.string() }),
  z.object({ code: z.literal('mode-not-covered'), mode: z.literal('rail'), line: z.string() }),
  z.object({ code: z.literal('no-known-elevator'), stationId: z.string() }),
  z.object({
    code: z.literal('elevator-out'),
    stationId: z.string(),
    deviceId: z.string(),
    platform: z.enum(['yours', 'other', 'uncertain']),
  }),
  z.object({
    code: z.literal('elevator-status-missing'),
    stationId: z.string(),
    deviceId: z.string(),
  }),
  z.object({ code: z.literal('escalator-out'), stationId: z.string(), deviceId: z.string() }),
  z.object({
    code: z.literal('elevator-out-backup'),
    stationId: z.string(),
    deviceId: z.string(),
    backupDeviceId: z.string(),
  }),
])

export const FindingSchema = z.object({
  effect: z.enum(['warning', 'blocked', 'unknown']),
  legIndex: z.number().int().nullable(),
  reason: ReasonSchema,
  /** Human-facing station name, when the reason names a station. */
  stationName: z.string().nullable(),
  /** The source's description of the device in question, when known. */
  deviceDescription: z.string().optional(),
  /** For elevator-out-backup: the description of the working elevator to use instead. */
  backupDescription: z.string().optional(),
})

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'bad-request',
      'not-found',
      'rate-limited',
      'not-configured',
      'upstream-failed',
      'internal',
    ]),
    message: z.string(),
  }),
  requestId: z.string(),
})

// --- GET /v1/health -----------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  commit: z.string(),
  env: z.string(),
})

// --- GET /v1/status -----------------------------------------------------------------------------

export const StatusResponseSchema = z.object({
  health: StatusHealthSchema,
  observedAt: z.iso.datetime().nullable(),
  ageSeconds: z.number().int().nullable(),
  maxAgeSeconds: z.number().int(),
  fetchedAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  devices: z.record(z.string(), DeviceStateSchema),
  /** Demo mode (ADR 0014): the last known statuses are shown as if current. Say so in the UI. */
  demo: z.boolean(),
})

// --- POST /v1/plan ------------------------------------------------------------------------------

/** Where a trip starts or ends: a picked place (main path), the device location, or free text. */
export const WaypointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place'), placeId: z.string().min(1).max(300) }),
  z.object({ kind: z.literal('point'), lat: Lat, lng: Lng }),
  z.object({ kind: z.literal('address'), text: z.string().trim().min(2).max(200) }),
])

export const PlanRequestSchema = z.object({
  origin: WaypointSchema,
  destination: WaypointSchema,
  departAt: z.iso.datetime().optional(),
})

const StopViewSchema = z.object({ name: z.string(), lat: Lat, lng: Lng })

export const LegViewSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('walk'),
    /** Already scaled to a reduced-mobility pace. */
    durationSeconds: z.number().int().nonnegative(),
    path: PathSchema,
  }),
  z.object({
    mode: z.enum(['metro', 'bus', 'rail']),
    durationSeconds: z.number().int().nonnegative(),
    /** Registry line ID for Metro ("L1"), the route number for buses ("210"). */
    line: z.string(),
    /** What riders see: "Línea 1", "210". */
    label: z.string(),
    color: z.string(),
    textColor: z.string(),
    headsign: z.string().nullable(),
    expressRoute: z.enum(['roja', 'verde']).nullable(),
    from: StopViewSchema,
    to: StopViewSchema,
    stopCount: z.number().int().nullable(),
    /** Timetable departure and arrival, when the provider gives them. */
    departAt: z.iso.datetime({ offset: true }).optional(),
    arriveAt: z.iso.datetime({ offset: true }).optional(),
    path: PathSchema,
  }),
])

export const RouteViewSchema = z.object({
  source: z.enum(['primary', 'alternative', 'bus-only']),
  verdict: z.object({ kind: VerdictKindSchema, findings: z.array(FindingSchema) }),
  /** Whole trip, with walking scaled to a reduced-mobility pace. */
  durationSeconds: z.number().int().nonnegative(),
  /**
   * When to leave and when you'll arrive, at a reduced-mobility pace: the first vehicle's
   * timetable departure minus the walk to it, the last one's arrival plus the walk after it.
   * Absent when the provider gives no timetable.
   */
  departAt: z.iso.datetime({ offset: true }).optional(),
  arriveAt: z.iso.datetime({ offset: true }).optional(),
  legs: z.array(LegViewSchema),
})

export const PlanResponseSchema = z.object({
  outcome: z.enum(['accessible', 'uncertain', 'no-accessible-route', 'no-route']),
  rerouted: z.boolean(),
  /** Best first. */
  routes: z.array(RouteViewSchema),
  status: z.object({
    health: StatusHealthSchema,
    observedAt: z.iso.datetime().nullable(),
    demo: z.boolean(),
  }),
})

// --- GET /v1/places -----------------------------------------------------------------------------

export const PlacesQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  /** One per search session; groups keystrokes for billing (roadmap phase 6). */
  session: z.uuid(),
})

export const PlacesResponseSchema = z.object({
  suggestions: z.array(
    z.object({ placeId: z.string(), primary: z.string(), secondary: z.string().nullable() }),
  ),
})

// --- POST /v1/interpret -------------------------------------------------------------------------

export const InterpretRequestSchema = z.object({ text: z.string().trim().min(3).max(300) })

export const InterpretResponseSchema = z.object({
  /** null when the user didn't say where they're starting from. */
  origin: z.string().nullable(),
  destination: z.string(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type Finding = z.infer<typeof FindingSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>
export type LegView = z.infer<typeof LegViewSchema>
export type PlacesResponse = z.infer<typeof PlacesResponseSchema>
export type PlanRequest = z.infer<typeof PlanRequestSchema>
export type PlanResponse = z.infer<typeof PlanResponseSchema>
export type RouteView = z.infer<typeof RouteViewSchema>
export type StatusHealth = z.infer<typeof StatusHealthSchema>
export type StatusResponse = z.infer<typeof StatusResponseSchema>
export type Waypoint = z.infer<typeof WaypointSchema>
