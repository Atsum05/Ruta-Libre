import { describe, expect, it } from 'vitest'
import {
  bus,
  metro,
  NOW,
  registry,
  route,
  S,
  snapshot,
  stopAt,
  walk,
} from './__fixtures__/network.ts'
import { evaluateRoute } from './evaluate.ts'
import { DeviceId } from './ids.ts'
import type { Registry } from './registry.ts'
import type { Leg } from './route.ts'
import type { DeviceState } from './status.ts'

// Universidad de Chile → Los Héroes on L1 heads west, towards San Pablo.
const westbound = metro(S.uChile, S.losHeroes, 'San Pablo')
// Los Héroes → Universidad de Chile on L1 heads east, towards Los Dominicos.
const eastbound = metro(S.losHeroes, S.uChile, 'Los Dominicos')

const codes = (v: { findings: readonly { reason: { code: string } }[] }) =>
  v.findings.map((f) => f.reason.code)

describe('evaluateRoute', () => {
  describe('clean trips', () => {
    it('is ok when every elevator on the path works', () => {
      const v = evaluateRoute(route(walk(120), westbound, walk(60)), snapshot(), registry, NOW)
      expect(v).toEqual({ kind: 'ok', findings: [] })
    })

    it('is ok for a bus-only trip, which has nothing to check', () => {
      expect(evaluateRoute(route(walk(60), bus('210')), snapshot(), registry, NOW).kind).toBe('ok')
    })
  })

  describe('broken elevators', () => {
    it('blocks when the elevator on your boarding platform is out', () => {
      const v = evaluateRoute(
        route(westbound),
        snapshot({ 'UC-L1-SP': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('blocked')
      expect(v.findings).toEqual([
        {
          effect: 'blocked',
          legIndex: 0,
          reason: {
            code: 'elevator-out',
            stationId: S.uChile,
            deviceId: DeviceId('UC-L1-SP'),
            platform: 'yours',
          },
        },
      ])
    })

    it('blocks when the elevator on your alighting platform is out', () => {
      const v = evaluateRoute(
        route(westbound),
        snapshot({ 'LH-L1-SP': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('blocked')
    })

    it('blocks when a station-wide access elevator is out', () => {
      const v = evaluateRoute(
        route(westbound),
        snapshot({ 'UC-ACC': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('blocked')
    })

    // Not silently ignored: we might have the direction wrong (ROADMAP phase 3).
    it('warns when the broken elevator is on the opposite platform', () => {
      const v = evaluateRoute(
        route(westbound),
        snapshot({ 'UC-L1-LD': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('warning')
      expect(v.findings[0]?.reason).toMatchObject({ code: 'elevator-out', platform: 'other' })
    })
  })

  describe('backup elevators: only one that makes the same trip (ADR 0015)', () => {
    const STREET = 'UC: boleteria <-> calle'
    // Universidad de Chile with two street elevators into one ticket hall, and a third that
    // starts from the same street but goes somewhere else.
    const withTwins: Registry = {
      ...registry,
      stations: registry.stations.map((station) =>
        station.id !== S.uChile
          ? station
          : {
              ...station,
              devices: [
                ...station.devices.map((d) => (d.id === 'UC-ACC' ? { ...d, link: STREET } : d)),
                {
                  id: DeviceId('UC-ACC2'),
                  kind: 'elevator',
                  scope: { kind: 'station' },
                  link: STREET,
                },
                {
                  id: DeviceId('UC-ACC3'),
                  kind: 'elevator',
                  scope: { kind: 'station' },
                  link: 'UC: calle <-> servicios',
                },
                {
                  id: DeviceId('UC-ESC2'),
                  kind: 'escalator',
                  scope: { kind: 'station' },
                  link: STREET,
                },
              ],
            },
      ),
    }
    const states = (extra: Record<string, DeviceState | 'missing'>) => {
      const snap = snapshot(extra)
      const devices = new Map(snap.devices)
      for (const id of ['UC-ACC2', 'UC-ACC3', 'UC-ESC2']) {
        const state = extra[id] ?? 'working'
        if (state === 'missing') devices.delete(DeviceId(id))
        else devices.set(DeviceId(id), state)
      }
      return { ...snap, devices }
    }
    const check = (extra: Record<string, DeviceState | 'missing'>) =>
      evaluateRoute(route(westbound), states(extra), withTwins, NOW)

    it('warns instead of blocking when a working twin makes the same trip, naming both', () => {
      const v = check({ 'UC-ACC': 'out-of-service' })
      expect(v.kind).toBe('warning')
      expect(v.findings).toEqual([
        {
          effect: 'warning',
          legIndex: 0,
          reason: {
            code: 'elevator-out-backup',
            stationId: S.uChile,
            deviceId: DeviceId('UC-ACC'),
            backupDeviceId: DeviceId('UC-ACC2'),
          },
        },
      ])
    })

    it('still blocks when the twin is out too', () => {
      const v = check({ 'UC-ACC': 'out-of-service', 'UC-ACC2': 'out-of-service' })
      expect(v.kind).toBe('blocked')
    })

    it('does not count a twin whose state is unknown', () => {
      expect(check({ 'UC-ACC': 'out-of-service', 'UC-ACC2': 'missing' }).kind).toBe('blocked')
    })

    it('does not count an elevator to another place, or an escalator, as a backup', () => {
      const v = check({ 'UC-ACC3': 'out-of-service' })
      expect(v.kind).toBe('blocked') // UC-ACC3 has no twin; UC-ACC goes elsewhere
      const onlyEscalator = check({ 'UC-ACC': 'out-of-service', 'UC-ACC2': 'out-of-service' })
      expect(codes(onlyEscalator)).not.toContain('elevator-out-backup')
    })

    it('says nothing about an unreported elevator whose twin works', () => {
      expect(check({ 'UC-ACC': 'missing' }).kind).toBe('ok')
    })

    it('keeps the old rules for an elevator without a link', () => {
      expect(check({ 'UC-L1-SP': 'out-of-service' }).kind).toBe('blocked')
    })
  })

  describe('escalators', () => {
    it('only warns when an escalator is out: the elevator still works', () => {
      const v = evaluateRoute(
        route(eastbound),
        snapshot({ 'UC-ESC': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('warning')
      expect(codes(v)).toEqual(['escalator-out'])
    })

    it('ignores a broken escalator on the opposite platform', () => {
      const v = evaluateRoute(
        route(westbound),
        snapshot({ 'LH-ESC-LD': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('ok')
    })

    it('ignores an escalator with no status: it could only ever warn', () => {
      expect(
        evaluateRoute(route(eastbound), snapshot({ 'UC-ESC': 'missing' }), registry, NOW).kind,
      ).toBe('ok')
    })
  })

  // Regression for prototype bug #1: stations were de-duplicated by name, so at a transfer only
  // the first leg's direction was checked.
  describe('transfer stations', () => {
    // L1 westbound into Los Héroes, then L2 south towards La Cisterna.
    const transfer = route(westbound, walk(180), metro(S.losHeroes, S.toesca, 'La Cisterna', 'L2'))

    it("blocks on the second leg's own platform, not the first leg's direction", () => {
      const v = evaluateRoute(transfer, snapshot({ 'LH-L2-LC': 'out-of-service' }), registry, NOW)
      expect(v.kind).toBe('blocked')
      expect(v.findings).toContainEqual({
        effect: 'blocked',
        legIndex: 2,
        reason: {
          code: 'elevator-out',
          stationId: S.losHeroes,
          deviceId: DeviceId('LH-L2-LC'),
          platform: 'yours',
        },
      })
    })

    it('only warns about the L2 platform you are not using', () => {
      const v = evaluateRoute(transfer, snapshot({ 'LH-L2-VN': 'out-of-service' }), registry, NOW)
      expect(v.kind).toBe('warning')
    })
  })

  describe('directions', () => {
    it('strips the express route before matching the direction', () => {
      const express = metro(S.uChile, S.losHeroes, 'San Pablo (Ruta Roja)')
      const v = evaluateRoute(
        route(express),
        snapshot({ 'UC-L1-LD': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('warning')
    })

    it('is unknown when a platform elevator is out but the direction is unclear', () => {
      // A short-turn train signed to an intermediate station: we can't tell the platform.
      const shortTurn = metro(S.uChile, S.losHeroes, 'Neptuno')
      const v = evaluateRoute(
        route(shortTurn),
        snapshot({ 'UC-L1-LD': 'out-of-service' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('unknown')
      expect(v.findings[0]?.reason).toMatchObject({ code: 'elevator-out', platform: 'uncertain' })
    })

    it('is ok with an unclear direction when every elevator works', () => {
      const v = evaluateRoute(route(metro(S.uChile, S.losHeroes, null)), snapshot(), registry, NOW)
      expect(v.kind).toBe('ok')
    })

    it('is unknown when an elevator of unknown platform is out', () => {
      const leg = metro(S.santaLucia, S.uChile, 'San Pablo')
      const v = evaluateRoute(route(leg), snapshot({ 'SL-UNK': 'out-of-service' }), registry, NOW)
      expect(v.kind).toBe('unknown')
    })
  })

  // Regression for prototype bug #2: failed status made every route look clean.
  describe('missing or stale data is unknown, never fine', () => {
    it('is unknown when there is no status snapshot', () => {
      const v = evaluateRoute(route(westbound), null, registry, NOW)
      expect(v).toEqual({
        kind: 'unknown',
        findings: [{ effect: 'unknown', legIndex: null, reason: { code: 'status-unavailable' } }],
      })
    })

    it('is unknown when the snapshot is older than the threshold', () => {
      const old = snapshot({}, NOW - 11 * 60_000)
      const v = evaluateRoute(route(westbound), old, registry, NOW)
      expect(v.kind).toBe('unknown')
      expect(v.findings[0]?.reason).toEqual({ code: 'status-stale', ageMs: 11 * 60_000 })
    })

    it('does not trust a broken elevator reported by a stale snapshot either', () => {
      const old = snapshot({ 'UC-L1-SP': 'out-of-service' }, NOW - 11 * 60_000)
      expect(evaluateRoute(route(westbound), old, registry, NOW).kind).toBe('unknown')
    })

    it('accepts a custom freshness threshold', () => {
      const s = snapshot({}, NOW - 2 * 60_000)
      expect(
        evaluateRoute(route(westbound), s, registry, NOW, { maxSnapshotAgeMs: 60_000 }).kind,
      ).toBe('unknown')
    })

    it('does not need status for a trip with no Metro legs', () => {
      expect(evaluateRoute(route(bus('210')), null, registry, NOW).kind).toBe('ok')
    })

    it('is unknown when a stop does not match any station', () => {
      const lost: Leg = {
        ...westbound,
        from: { name: 'Universidad de Chile', location: { lat: -33.47, lng: -70.6 } },
      }
      const v = evaluateRoute(route(lost), snapshot(), registry, NOW)
      expect(v.kind).toBe('unknown')
      expect(v.findings[0]?.reason).toEqual({
        code: 'stop-unmatched',
        stopName: 'Universidad de Chile',
      })
    })

    it('is unknown when an elevator on the path has no status', () => {
      const v = evaluateRoute(route(westbound), snapshot({ 'UC-L1-SP': 'missing' }), registry, NOW)
      expect(v.kind).toBe('unknown')
      expect(codes(v)).toEqual(['elevator-status-missing'])
    })

    it('ignores a missing status for an elevator on the other platform', () => {
      expect(
        evaluateRoute(route(westbound), snapshot({ 'UC-L1-LD': 'missing' }), registry, NOW).kind,
      ).toBe('ok')
    })

    it('is unknown at a station with no known elevator', () => {
      const leg = metro(S.parqueBustamante, S.sanPablo, 'San Pablo', 'L5')
      const v = evaluateRoute(route(leg), snapshot(), registry, NOW)
      expect(v.kind).toBe('unknown')
      expect(v.findings[0]?.reason).toEqual({
        code: 'no-known-elevator',
        stationId: S.parqueBustamante,
      })
    })

    it('is unknown for train legs, which we have no accessibility data for', () => {
      const train: Leg = { ...westbound, mode: 'rail', line: 'Tren Nos' }
      const v = evaluateRoute(route(train), snapshot(), registry, NOW)
      expect(v.findings).toEqual([
        {
          effect: 'unknown',
          legIndex: 0,
          reason: { code: 'mode-not-covered', mode: 'rail', line: 'Tren Nos' },
        },
      ])
    })
  })

  describe('combining findings', () => {
    it('is blocked when one problem is confirmed even if another is unknown', () => {
      const leg = metro(S.uChile, S.losHeroes, 'San Pablo')
      const v = evaluateRoute(
        route(leg),
        snapshot({ 'UC-L1-SP': 'out-of-service', 'LH-L1-SP': 'missing' }),
        registry,
        NOW,
      )
      expect(v.kind).toBe('blocked')
      expect(codes(v)).toEqual(['elevator-out', 'elevator-status-missing'])
    })

    it('matches stops by location even when the name is spelled differently', () => {
      const leg: Leg = { ...westbound, from: stopAt(S.uChile, 'Estación U. de Chile') }
      expect(evaluateRoute(route(leg), snapshot(), registry, NOW).kind).toBe('ok')
    })
  })
})
