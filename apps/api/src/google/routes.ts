import type { Waypoint } from '@rutalibre/contract'
import type { TransitMode } from '@rutalibre/core'
import { z } from 'zod'
import { requestJson, UpstreamError } from '../http/request.ts'
import type {
  DetailedRoute,
  DetailedTransitLeg,
  DetailedWalkLeg,
  Path,
  RoutingProvider,
  RoutingRequest,
} from '../providers.ts'
import { decodePolyline } from './polyline.ts'

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

// Stop locations (ADR 0006) and textColor (badge contrast) were missing in the prototype.
export const FIELD_MASK = [
  'routes.duration',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.transitDetails.headsign',
  'routes.legs.steps.transitDetails.stopCount',
  'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
  'routes.legs.steps.transitDetails.stopDetails.departureStop.location',
  'routes.legs.steps.transitDetails.stopDetails.arrivalStop.name',
  'routes.legs.steps.transitDetails.stopDetails.arrivalStop.location',
  'routes.legs.steps.transitDetails.stopDetails.departureTime',
  'routes.legs.steps.transitDetails.stopDetails.arrivalTime',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
  'routes.legs.steps.transitDetails.transitLine.color',
  'routes.legs.steps.transitDetails.transitLine.textColor',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
].join(',')

const LatLngSchema = z.object({ latitude: z.number(), longitude: z.number() })
const StopSchema = z.object({
  name: z.string().optional(),
  location: z.object({ latLng: LatLngSchema }).optional(),
})
const StepSchema = z.object({
  travelMode: z.string().optional(),
  staticDuration: z.string().optional(),
  polyline: z.object({ encodedPolyline: z.string() }).optional(),
  transitDetails: z
    .object({
      headsign: z.string().optional(),
      stopCount: z.number().int().optional(),
      stopDetails: z
        .object({
          departureStop: StopSchema,
          arrivalStop: StopSchema,
          // Timetable times, RFC 3339 (e.g. "2026-10-31T17:05:00Z").
          departureTime: z.iso.datetime({ offset: true }),
          arrivalTime: z.iso.datetime({ offset: true }),
        })
        .partial()
        .optional(),
      transitLine: z
        .object({
          name: z.string(),
          nameShort: z.string(),
          color: z.string(),
          textColor: z.string(),
          vehicle: z.object({ type: z.string() }).partial(),
        })
        .partial()
        .optional(),
    })
    .optional(),
})
const ResponseSchema = z.object({
  routes: z
    .array(
      z.object({
        duration: z.string().optional(),
        legs: z.array(z.object({ steps: z.array(StepSchema).optional() })).optional(),
      }),
    )
    .optional(),
})
type Step = z.infer<typeof StepSchema>

export interface GoogleRoutesOptions {
  readonly apiKey: string
  readonly timeoutMs: number
  readonly fetchFn?: typeof fetch
}

/** Transit routing from the Google Routes API (ADR 0007, 0009). */
export class GoogleRoutesProvider implements RoutingProvider {
  readonly #options: GoogleRoutesOptions

  constructor(options: GoogleRoutesOptions) {
    this.#options = options
  }

  async plan(request: RoutingRequest): Promise<DetailedRoute[]> {
    const { apiKey, timeoutMs, fetchFn } = this.#options
    const body = {
      origin: toGoogleWaypoint(request.origin),
      destination: toGoogleWaypoint(request.destination),
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: true,
      languageCode: 'es-CL',
      regionCode: 'CL',
      ...(request.departAt && { departureTime: request.departAt }),
      transitPreferences: {
        // Fewer metres on foot matter more than a few minutes for someone with reduced mobility.
        routingPreference: 'LESS_WALKING',
        ...(request.travel !== 'any' && {
          allowedTravelModes: [request.travel === 'metro' ? 'SUBWAY' : 'BUS'],
        }),
      },
    }
    const json = await requestJson(
      ROUTES_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      },
      { timeoutMs, retries: 1, ...(fetchFn && { fetchFn }) },
    )
    const parsed = ResponseSchema.safeParse(json)
    if (!parsed.success) throw new UpstreamError('Routes API: unexpected response format')
    return (parsed.data.routes ?? []).map((r) =>
      toRoute(
        parseSeconds(r.duration),
        (r.legs ?? []).flatMap((l) => l.steps ?? []),
      ),
    )
  }
}

/** Free text is anchored to Santiago: "Irarrázaval" alone geocoded to Maipú (prototype lesson). */
export function toGoogleWaypoint(w: Waypoint): object {
  switch (w.kind) {
    case 'place':
      return { placeId: w.placeId }
    case 'point':
      return { location: { latLng: { latitude: w.lat, longitude: w.lng } } }
    case 'address':
      return { address: /santiago|chile/i.test(w.text) ? w.text : `${w.text}, Santiago, Chile` }
  }
}

const parseSeconds = (d: string | undefined) => Number.parseInt(d ?? '0', 10) || 0

function vehicleMode(type: string | undefined): TransitMode {
  if (type === 'SUBWAY' || type === 'METRO_RAIL') return 'metro'
  if (type === 'BUS' || type === 'INTERCITY_BUS' || type === 'TROLLEYBUS') return 'bus'
  // Anything else (trains, trams…) has no accessibility data: core reports it as not covered.
  return 'rail'
}

/** "Línea 4A" or "L4a" → "L4A", the registry's line ID (ADR 0011). */
export function metroLineId(name: string | undefined, nameShort: string | undefined): string {
  for (const text of [nameShort, name]) {
    const m = /^(?:l[ií]nea\s*|l)(\d+[a-z]?)$/i.exec(text?.trim() ?? '')
    if (m?.[1]) return `L${m[1].toUpperCase()}`
  }
  return nameShort ?? name ?? '?'
}

/** Bus stop names carry a code prefix: "PB1960-Parada 6 / (M) Pza. Chacabuco". */
const cleanStopName = (name: string | undefined) =>
  (name ?? '').replace(/^P[A-Z]{1,2}\d+\s*-\s*/, '')

/** Black or white, whichever reads better on the line colour (WCAG relative luminance). */
export function readableTextColor(background: string): string {
  const hex = /^#?([0-9a-f]{6})$/i.exec(background)?.[1]
  if (!hex) return '#ffffff'
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  // Contrast with black beats contrast with white above this luminance.
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

function toRoute(durationSeconds: number, steps: readonly Step[]): DetailedRoute {
  const legs: (DetailedWalkLeg | DetailedTransitLeg)[] = []

  for (const step of steps) {
    const path: Path = step.polyline ? decodePolyline(step.polyline.encodedPolyline) : []
    const seconds = parseSeconds(step.staticDuration)
    const t = step.transitDetails

    if (step.travelMode !== 'TRANSIT' || !t) {
      // Consecutive walking instructions become one walking leg.
      const last = legs.at(-1)
      if (last?.mode === 'walk') {
        legs[legs.length - 1] = {
          mode: 'walk',
          durationSeconds: last.durationSeconds + seconds,
          path: [...last.path, ...path],
        }
      } else if (seconds > 0 || path.length > 0) {
        legs.push({ mode: 'walk', durationSeconds: seconds, path })
      }
      continue
    }

    const line = t.transitLine ?? {}
    const mode = vehicleMode(line.vehicle?.type)
    const color = line.color ?? '#5b6372'
    const stop = (
      s: z.infer<typeof StopSchema> | undefined,
      fallback: readonly [number, number] | undefined,
    ) => {
      const at = s?.location?.latLng
      // Without a position, use the path's end; with neither, NaN never matches a station.
      const [lng, lat] = at ? [at.longitude, at.latitude] : (fallback ?? [Number.NaN, Number.NaN])
      return { name: cleanStopName(s?.name), location: { lat, lng } }
    }
    legs.push({
      mode,
      durationSeconds: seconds,
      line:
        mode === 'metro'
          ? metroLineId(line.name, line.nameShort)
          : (line.nameShort ?? line.name ?? '?'),
      label:
        mode === 'bus'
          ? (line.nameShort ?? line.name ?? '?')
          : (line.name ?? line.nameShort ?? '?'),
      headsign: t.headsign ?? null,
      from: stop(t.stopDetails?.departureStop, path[0]),
      to: stop(t.stopDetails?.arrivalStop, path.at(-1)),
      color,
      textColor: line.textColor ?? readableTextColor(color),
      stopCount: t.stopCount ?? null,
      ...(t.stopDetails?.departureTime && { departAt: t.stopDetails.departureTime }),
      ...(t.stopDetails?.arrivalTime && { arriveAt: t.stopDetails.arrivalTime }),
      path,
    })
  }
  return { durationSeconds, legs }
}
