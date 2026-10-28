import { distanceMeters, normalizeName } from '@rutalibre/core'
import { LINES, type LineConfig, TERMINAL_SPELLINGS } from './config.ts'
import { deviceKind, displayName, parseDirections, type TerminalName } from './parse.ts'
import type { Catalogue, LiveDevices, StationsFile } from './schema.ts'

export type IssueKind =
  /** In the catalogue but not the live feed: we can't tell elevator from escalator. */
  | 'device-not-in-live-feed'
  /** In the live feed but its station code isn't in the catalogue: no position. */
  | 'device-station-unknown'
  /** The live feed's `tipo` is neither ascensor nor escalera. */
  | 'device-kind-unknown'
  /** A "dirección" named something that isn't a terminal: scope becomes unknown. */
  | 'direction-unrecognised'
  /** The catalogue line name isn't in config.LINES. */
  | 'line-unknown'
  /** A configured terminal has no station on its line. */
  | 'terminal-not-found'
  /** Two stations on the same line share a name. */
  | 'duplicate-name'
  /** Informational: a station with no elevator on record (verdicts there are `unknown`). */
  | 'station-without-elevator'
  /** One complex's per-line codes are far apart: likely a coordinate error in the catalogue. */
  | 'complex-far-apart'

export interface Issue {
  readonly kind: IssueKind
  /** Device ID, station code, or line, depending on the kind. Stable, so it can be explained. */
  readonly subject: string
  readonly detail: string
}

export interface BuildResult {
  readonly file: StationsFile
  readonly issues: readonly Issue[]
}

/** Issue key used by config.EXPLAINED_ISSUES. */
export const issueKey = (issue: Issue) => `${issue.kind}:${issue.subject}`

/** Same-name codes farther apart than this are reported: a transfer is rarely this spread out. */
const MAX_COMPLEX_SPREAD_M = 300

type CatalogueStation = { code: string; name: string; line: LineConfig; lat: number; lng: number }

/**
 * Builds stations.json from the device catalogue (positions, station codes, lines) and the live
 * feed's static fields (device kind, and the texts that say which platform a device serves).
 * Pure: the CLI does the file I/O. Each catalogue station code is one line's part of a station
 * (ADR 0011).
 */
export function buildRegistry(catalogue: Catalogue, live: LiveDevices): BuildResult {
  const issues: Issue[] = []
  const linesByCatalogueName = new Map(LINES.map((l) => [l.catalogueName, l]))

  // Station codes, with their line and position (all of a code's devices share one coordinate).
  const stations = new Map<string, CatalogueStation>()
  for (const f of catalogue.features) {
    const p = f.properties
    const line = linesByCatalogueName.get(p.linea)
    if (!line) {
      issues.push({ kind: 'line-unknown', subject: p.linea, detail: `station ${p.estacion}` })
      continue
    }
    const [lng, lat] = f.geometry.coordinates
    if (!stations.has(p.estacion)) {
      stations.set(p.estacion, { code: p.estacion, name: p.nombre_estacion, line, lat, lng })
    }
  }

  // Terminal station codes per line, and every spelling of each terminal for "dirección" texts.
  const terminalNames: TerminalName[] = []
  const lines = LINES.map((line) => {
    const terminals = line.terminals.map((terminal) => {
      const found = [...stations.values()].find(
        (s) =>
          s.line.id === line.id && normalizeName(displayName(s.name)) === normalizeName(terminal),
      )
      if (!found) {
        issues.push({ kind: 'terminal-not-found', subject: `${line.id}:${terminal}`, detail: '' })
        return ''
      }
      for (const spelling of [terminal, ...(TERMINAL_SPELLINGS[terminal] ?? [])]) {
        terminalNames.push({ stationId: found.code as never, name: normalizeName(spelling) })
      }
      return found.code
    })
    return { id: line.id, terminals }
  })

  // Devices: the union of both sources, keyed by ID.
  const devicesByStation = new Map<string, StationsFile['stations'][number]['devices']>()
  const catalogueStationOf = new Map(
    catalogue.features.map((f) => [f.properties.equipo, f.properties.estacion]),
  )
  const ids = [...new Set([...catalogueStationOf.keys(), ...Object.keys(live)])].sort()

  for (const id of ids) {
    const info = live[id]
    if (!info) {
      issues.push({
        kind: 'device-not-in-live-feed',
        subject: id,
        detail: `station ${catalogueStationOf.get(id)}`,
      })
      continue
    }
    if (!stations.has(info.estacion)) {
      issues.push({
        kind: 'device-station-unknown',
        subject: id,
        detail: `station code ${info.estacion}`,
      })
      continue
    }
    const kind = deviceKind(info.tipo)
    if (!kind) {
      issues.push({ kind: 'device-kind-unknown', subject: id, detail: `tipo "${info.tipo}"` })
      continue
    }
    const { towards, unrecognised } = parseDirections(info.texto, terminalNames)
    for (const text of unrecognised) {
      issues.push({ kind: 'direction-unrecognised', subject: id, detail: `"dirección ${text}…"` })
    }
    const scope =
      towards.length > 0
        ? { kind: 'platform' as const, towards: [...towards] }
        : unrecognised.length > 0
          ? { kind: 'unknown' as const }
          : { kind: 'station' as const }
    const list = devicesByStation.get(info.estacion) ?? []
    list.push({ id, kind, scope })
    devicesByStation.set(info.estacion, list)
  }

  // A transfer station has one code per line. Street access is shared, so a station-wide device
  // of one code counts for every code of the same complex (ADR 0011).
  const complexes = new Map<string, CatalogueStation[]>()
  for (const s of stations.values()) {
    const key = normalizeName(displayName(s.name))
    complexes.set(key, [...(complexes.get(key) ?? []), s])
  }
  for (const members of complexes.values()) {
    if (members.length < 2) continue
    const spread = Math.max(...members.flatMap((a) => members.map((b) => distanceMeters(a, b))))
    if (spread > MAX_COMPLEX_SPREAD_M) {
      issues.push({
        kind: 'complex-far-apart',
        subject: members.map((m) => m.code).join('+'),
        detail: `${displayName(members[0]?.name ?? '')}: codes ${Math.round(spread)} m apart`,
      })
    }
    const shared = members.flatMap((m) =>
      (devicesByStation.get(m.code) ?? []).filter((d) => d.scope.kind === 'station'),
    )
    for (const m of members) {
      const own = devicesByStation.get(m.code) ?? []
      const borrowed = shared.filter((d) => !own.some((o) => o.id === d.id))
      devicesByStation.set(
        m.code,
        [...own, ...borrowed].sort((a, b) => a.id.localeCompare(b.id)),
      )
    }
  }

  // Station entries, sorted by code so the committed file diffs cleanly.
  const seenNames = new Map<string, string>()
  const stationEntries = [...stations.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((s) => {
      const name = displayName(s.name)
      const key = `${s.line.id}:${normalizeName(name)}`
      const other = seenNames.get(key)
      if (other)
        issues.push({
          kind: 'duplicate-name',
          subject: s.code,
          detail: `same as ${other} on ${s.line.id}`,
        })
      seenNames.set(key, s.code)

      const devices = devicesByStation.get(s.code) ?? []
      if (!devices.some((d) => d.kind === 'elevator')) {
        issues.push({ kind: 'station-without-elevator', subject: s.code, detail: name })
      }
      return {
        id: s.code,
        name,
        location: { lat: s.lat, lng: s.lng },
        lines: [s.line.id],
        aliases: name === s.name ? [] : [s.name],
        devices,
      }
    })

  return { file: { lines, stations: stationEntries }, issues }
}
