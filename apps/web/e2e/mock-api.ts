import { createRequire } from 'node:module'
import type { Page } from '@playwright/test'
import type { LegView, PlanResponse, RouteView, StatusResponse } from '@rutalibre/contract'

// Responses in the contract's shape. The API's own integration tests prove the real API
// produces these shapes; here we prove the UI handles each one.

export const STATUS: Record<'ok' | 'stale', StatusResponse> = {
  ok: {
    health: 'ok',
    observedAt: '2026-10-28T12:00:00.000Z',
    ageSeconds: 600,
    maxAgeSeconds: 46_800,
    fetchedAt: '2026-10-28T12:09:00.000Z',
    lastError: null,
    devices: {},
  },
  stale: {
    health: 'stale',
    observedAt: '2026-10-16T23:21:16.000Z',
    ageSeconds: 11 * 86_400,
    maxAgeSeconds: 46_800,
    fetchedAt: '2026-10-28T12:09:00.000Z',
    lastError: null,
    devices: {},
  },
}

const metroLeg = (headsign: string, from: string, to: string): LegView => ({
  mode: 'metro',
  durationSeconds: 300,
  line: 'L1',
  label: 'Línea 1',
  color: '#e1261c',
  textColor: '#ffffff',
  headsign,
  expressRoute: null,
  from: { name: from, lat: -33.444, lng: -70.6495 },
  to: { name: to, lat: -33.4458, lng: -70.6605 },
  stopCount: 2,
  path: [
    [-70.6495, -33.444],
    [-70.6605, -33.4458],
  ],
})

const OK_ROUTE: RouteView = {
  source: 'primary',
  verdict: { kind: 'ok', findings: [] },
  durationSeconds: 1500,
  legs: [
    { mode: 'walk', durationSeconds: 270, path: [] },
    metroLeg('San Pablo', 'Universidad de Chile', 'Los Héroes'),
  ],
}

const BLOCKED_ROUTE: RouteView = {
  source: 'primary',
  verdict: {
    kind: 'blocked',
    findings: [
      {
        effect: 'blocked',
        legIndex: 0,
        stationName: 'Los Héroes',
        reason: { code: 'elevator-out', stationId: 'LH', deviceId: 'LH-60d634', platform: 'yours' },
      },
    ],
  },
  durationSeconds: 1300,
  legs: [metroLeg('San Pablo', 'Universidad de Chile', 'Los Héroes')],
}

const BUS_ROUTE: RouteView = {
  source: 'alternative',
  verdict: { kind: 'ok', findings: [] },
  durationSeconds: 2400,
  legs: [
    { mode: 'walk', durationSeconds: 180, path: [] },
    {
      mode: 'bus',
      durationSeconds: 1500,
      line: '210',
      label: '210',
      color: '#00a0e9',
      textColor: '#000000',
      headsign: 'Gran Avenida',
      expressRoute: null,
      from: { name: 'Parada 6 / (M) Universidad de Chile', lat: -33.444, lng: -70.653 },
      to: { name: 'Parada 2 / Toesca', lat: -33.453, lng: -70.657 },
      stopCount: 9,
      path: [],
    },
  ],
}

const status = { health: 'ok', observedAt: '2026-10-28T12:00:00.000Z' } as const

export const PLANS: Record<'clean' | 'rerouted' | 'noAlternative', PlanResponse> = {
  clean: { outcome: 'accessible', rerouted: false, routes: [OK_ROUTE], status },
  rerouted: { outcome: 'accessible', rerouted: true, routes: [BUS_ROUTE, BLOCKED_ROUTE], status },
  noAlternative: {
    outcome: 'no-accessible-route',
    rerouted: false,
    routes: [BLOCKED_ROUTE],
    status,
  },
}

/** Answers /api/* like the real API would, and keeps Google Maps out of the test. */
export async function mockApi(page: Page, { plan = PLANS.clean, status: s = STATUS.ok } = {}) {
  // Exact hostnames, not a substring regex: a URL that merely contains the name mustn't match.
  const google = new Set(['maps.googleapis.com', 'maps.gstatic.com'])
  await page.route(
    (url) => google.has(url.hostname),
    (route) => route.abort(),
  )
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (body: unknown) => route.fulfill({ json: body })
    if (path === '/api/v1/status') return json(s)
    if (path === '/api/v1/health')
      return json({ status: 'ok', version: '0.1.0', commit: 'e2e', env: 'local' })
    if (path === '/api/v1/plan') return json(plan)
    if (path === '/api/v1/interpret') {
      return json({ origin: 'Universidad de Chile', destination: 'Toesca' })
    }
    if (path === '/api/v1/places') {
      const q = new URL(route.request().url()).searchParams.get('q') ?? ''
      return json({
        suggestions: q.toLowerCase().startsWith('uni')
          ? [{ placeId: 'p-uchile', primary: 'Universidad de Chile', secondary: 'Santiago' }]
          : [{ placeId: 'p-toesca', primary: 'Toesca', secondary: 'Santiago' }],
      })
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: 'not-found', message: '' }, requestId: 'e2e' },
    })
  })
}

/** Picks a place in a field the way a person would: type, then choose a suggestion. */
export async function pick(page: Page, field: 'Desde' | 'Hasta', text: string, option: RegExp) {
  await page.getByRole('combobox', { name: field }).fill(text)
  await page.getByRole('option', { name: option }).click()
}

const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')

/** WCAG 2.2 AA violations in the real browser, including colour contrast. */
export async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH })
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            o: object,
          ) => Promise<{ violations: { id: string; help: string; nodes: unknown[] }[] }>
        }
      }
    ).axe
    const result = await axe.run({
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
  })
}
