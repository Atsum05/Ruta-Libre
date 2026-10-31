import { DeviceId, type DeviceState, type StatusSnapshot } from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { silentLogger } from '../log.ts'
import type { StatusProvider } from '../providers.ts'
import { StatusPoller } from './poller.ts'
import { diffSnapshots, InMemorySnapshotStore, InMemoryStatusHistory } from './store.ts'

const snap = (observedAt: number, states: Record<string, DeviceState>): StatusSnapshot => ({
  observedAt,
  devices: new Map(Object.entries(states).map(([id, s]) => [DeviceId(id), s])),
})

/** A provider that returns (or throws) the queued results in order. */
function scripted(...results: (StatusSnapshot | Error)[]): StatusProvider {
  return {
    async snapshot() {
      const next = results.shift()
      if (next === undefined || next instanceof Error) throw next ?? new Error('no more results')
      return next
    },
  }
}

function setup(...results: (StatusSnapshot | Error)[]) {
  const store = new InMemorySnapshotStore()
  const history = new InMemoryStatusHistory()
  let clock = 1_000
  const poller = new StatusPoller({
    provider: scripted(...results),
    store,
    history,
    log: silentLogger,
    now: () => clock,
  })
  return { store, history, poller, tick: (ms: number) => (clock += ms) }
}

describe('StatusPoller', () => {
  it('stores a good snapshot with the fetch time', async () => {
    const first = snap(500, { A: 'working' })
    const { store, poller } = setup(first)
    await poller.refresh()
    expect(await store.get()).toEqual({
      snapshot: first,
      fetchedAt: 1_000,
      lastError: null,
      failingSince: null,
    })
  })

  it('keeps the last good snapshot when the upstream fails, and records why', async () => {
    const first = snap(500, { A: 'working' })
    const { store, poller, tick } = setup(first, new Error('HTTP 503'))
    await poller.refresh()
    tick(60_000)
    await poller.refresh()
    expect(await store.get()).toEqual({
      snapshot: first,
      fetchedAt: 1_000,
      lastError: 'HTTP 503',
      failingSince: 61_000,
    })
  })

  it('remembers when a run of failures began', async () => {
    const { store, poller, tick } = setup(new Error('down'), new Error('still down'))
    await poller.refresh()
    tick(60_000)
    await poller.refresh()
    expect(await store.get()).toMatchObject({
      snapshot: null,
      lastError: 'still down',
      failingSince: 1_000,
    })
  })

  it('clears the error when the upstream recovers', async () => {
    const { store, poller } = setup(new Error('down'), snap(500, { A: 'working' }))
    await poller.refresh()
    await poller.refresh()
    expect(await store.get()).toMatchObject({ lastError: null, failingSince: null })
  })

  it('refuses a snapshot older than the one it has', async () => {
    const newer = snap(900, { A: 'working' })
    const { store, poller } = setup(newer, snap(500, { A: 'out-of-service' }))
    await poller.refresh()
    await poller.refresh()
    const stored = await store.get()
    expect(stored.snapshot).toBe(newer)
    expect(stored.lastError).toMatch(/back in time/)
  })

  it('records each status change in the history', async () => {
    const { history, poller } = setup(
      snap(500, { A: 'working', B: 'working' }),
      snap(900, { A: 'out-of-service', B: 'working', C: 'working' }),
    )
    await poller.refresh()
    await poller.refresh()
    expect(history.recent()).toEqual([
      { deviceId: 'A', from: 'working', to: 'out-of-service', observedAt: 900 },
      { deviceId: 'C', from: null, to: 'working', observedAt: 900 },
    ])
  })

  it('polls on an interval until stopped', async () => {
    const results = Array.from({ length: 5 }, (_, i) => snap(i, { A: 'working' }))
    const { store, poller } = setup(...results)
    poller.start(1)
    await new Promise((resolve) => setTimeout(resolve, 30))
    poller.stop()
    expect((await store.get()).snapshot).not.toBeNull()
  })
})

describe('diffSnapshots', () => {
  it('reports nothing on the first snapshot', () => {
    expect(diffSnapshots(null, snap(1, { A: 'working' }))).toEqual([])
  })

  it('reports a device that disappeared', () => {
    expect(diffSnapshots(snap(1, { A: 'working' }), snap(2, {}))).toEqual([
      { deviceId: 'A', from: 'working', to: null, observedAt: 2 },
    ])
  })
})

describe('InMemoryStatusHistory', () => {
  it('keeps only the most recent changes', async () => {
    const history = new InMemoryStatusHistory(2)
    const change = (id: string) => ({
      deviceId: DeviceId(id),
      from: null,
      to: 'working' as const,
      observedAt: 1,
    })
    await history.record([change('A'), change('B'), change('C')])
    expect(history.recent().map((c) => c.deviceId)).toEqual(['B', 'C'])
  })
})
