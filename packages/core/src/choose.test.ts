import { describe, expect, it } from 'vitest'
import { bus, metro, route, S } from './__fixtures__/network.ts'
import { type Candidate, chooseRoute, hasAccessibleRoute } from './choose.ts'
import type { Route } from './route.ts'
import type { VerdictKind } from './verdict.ts'

let n = 0
function candidate(kind: VerdictKind, source: Candidate['source']): Candidate {
  // A distinct route per candidate so tests can tell them apart by identity.
  const r: Route = route(metro(S.uChile, S.losHeroes, `test-${n++}`))
  return { route: r, source, verdict: { kind, findings: [] } }
}

describe('chooseRoute', () => {
  it('keeps the primary route when it is ok', () => {
    const primary = candidate('ok', 'primary')
    const plan = chooseRoute([primary, candidate('ok', 'alternative')])
    expect(plan).toMatchObject({ outcome: 'accessible', rerouted: false })
    expect(plan.best).toBe(primary)
  })

  it('does not reroute for a warning: an escalator out still leaves the elevator', () => {
    const primary = candidate('warning', 'primary')
    const plan = chooseRoute([primary, candidate('ok', 'alternative')])
    expect(plan.best).toBe(primary)
    expect(plan.rerouted).toBe(false)
  })

  it('reroutes to an accessible alternative when the primary is blocked', () => {
    const alternative = candidate('ok', 'alternative')
    const plan = chooseRoute([candidate('blocked', 'primary'), alternative])
    expect(plan).toMatchObject({ best: alternative, outcome: 'accessible', rerouted: true })
  })

  it('prefers Metro alternatives over the bus-only fallback', () => {
    const alternative = candidate('warning', 'alternative')
    const busOnly = { ...candidate('ok', 'bus-only'), route: route(bus('210')) }
    const plan = chooseRoute([busOnly, candidate('blocked', 'primary'), alternative])
    expect(plan.best).toBe(alternative)
  })

  it('falls back to bus only when every Metro route is blocked', () => {
    const busOnly = candidate('ok', 'bus-only')
    const plan = chooseRoute([
      candidate('blocked', 'primary'),
      candidate('blocked', 'alternative'),
      busOnly,
    ])
    expect(plan).toMatchObject({ best: busOnly, outcome: 'accessible', rerouted: true })
  })

  it('ranks unknown below ok and warning but above blocked (ADR 0005)', () => {
    const blocked = candidate('blocked', 'primary')
    const unknown = candidate('unknown', 'alternative')
    const warning = candidate('warning', 'bus-only')
    const plan = chooseRoute([blocked, unknown, warning])
    expect(plan.ranked).toEqual([warning, unknown, blocked])
  })

  it('reports uncertainty when the best route is unknown', () => {
    const plan = chooseRoute([candidate('blocked', 'primary'), candidate('unknown', 'alternative')])
    expect(plan.outcome).toBe('uncertain')
  })

  it('says there is no accessible route when all are blocked, still showing the primary', () => {
    const primary = candidate('blocked', 'primary')
    const plan = chooseRoute([primary, candidate('blocked', 'bus-only')])
    expect(plan).toMatchObject({ best: primary, outcome: 'no-accessible-route', rerouted: false })
  })

  it('keeps the provider order within the same tier and source', () => {
    const first = candidate('ok', 'alternative')
    const second = candidate('ok', 'alternative')
    expect(chooseRoute([first, second]).ranked).toEqual([first, second])
  })

  it('handles having no routes at all', () => {
    expect(chooseRoute([])).toEqual({
      ranked: [],
      best: null,
      outcome: 'no-route',
      rerouted: false,
    })
  })
})

describe('hasAccessibleRoute', () => {
  it('is true when any route is ok or warning', () => {
    expect(
      hasAccessibleRoute([candidate('blocked', 'primary'), candidate('warning', 'alternative')]),
    ).toBe(true)
  })

  it('is false when only unknown or blocked routes exist, so the API tries bus only', () => {
    expect(
      hasAccessibleRoute([candidate('blocked', 'primary'), candidate('unknown', 'alternative')]),
    ).toBe(false)
  })
})
