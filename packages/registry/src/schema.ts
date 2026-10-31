import { DeviceId, type Registry, StationId } from '@rutalibre/core'
import { z } from 'zod'

// --- Inputs -------------------------------------------------------------------------------------

/** The device catalogue (ariellopez.cl): one GeoJSON point per elevator or escalator. */
export const CatalogueSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      properties: z.object({
        equipo: z.string().min(1),
        estacion: z.string().min(1),
        nombre_estacion: z.string().min(1),
        linea: z.string().min(1),
      }),
      geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
    }),
  ),
})
export type Catalogue = z.infer<typeof CatalogueSchema>

/** Static fields of the live feed (seguimos.cl), keyed by device ID. */
export const LiveDevicesSchema = z.record(
  z.string().min(1),
  z.object({ estacion: z.string().min(1), tipo: z.string(), texto: z.string() }),
)
export type LiveDevices = z.infer<typeof LiveDevicesSchema>

// --- Output: stations.json ----------------------------------------------------------------------

const LatLngSchema = z.object({
  lat: z.number().min(-34).max(-33),
  lng: z.number().min(-71.2).max(-70.3),
})

const ScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('station') }),
  z.object({ kind: z.literal('platform'), towards: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal('unknown') }),
])

export const StationsFileSchema = z.object({
  lines: z.array(
    z.object({ id: z.string().min(1), terminals: z.array(z.string().min(1)).length(2) }),
  ),
  stations: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      location: LatLngSchema,
      lines: z.array(z.string().min(1)).min(1),
      aliases: z.array(z.string()),
      devices: z.array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(['elevator', 'escalator']),
          scope: ScopeSchema,
        }),
      ),
    }),
  ),
})
export type StationsFile = z.infer<typeof StationsFileSchema>

/** Parses stations.json into core's branded types. Throws if the file breaks the schema. */
export function parseStationsFile(json: unknown): Registry {
  const file = StationsFileSchema.parse(json)
  return {
    lines: file.lines.map((l) => ({ id: l.id, terminals: l.terminals.map(StationId) })),
    stations: file.stations.map((s) => ({
      ...s,
      id: StationId(s.id),
      devices: s.devices.map((d) => ({
        id: DeviceId(d.id),
        kind: d.kind,
        scope:
          d.scope.kind === 'platform'
            ? { kind: 'platform', towards: d.scope.towards.map(StationId) }
            : d.scope,
      })),
    })),
  }
}
