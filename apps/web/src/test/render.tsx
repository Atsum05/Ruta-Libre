import type { LegView, PlanResponse, RouteView, StatusResponse } from '@rutalibre/contract'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { afterEach, vi } from 'vitest'
import { I18nProvider, type Locale } from '../shared/i18n/index.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Renders with the app's providers: a fresh query cache (no retries) and a fixed language. */
export function renderApp(ui: ReactElement, locale: Locale = 'es') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale={locale}>{ui}</I18nProvider>
    </QueryClientProvider>,
  )
}

/** Answers API calls by path, like the same-origin proxy would; records what was requested. */
export function stubApi(
  routes: Record<string, unknown | ((url: URL, init?: RequestInit) => unknown)>,
) {
  const calls: { url: URL; init: RequestInit | undefined }[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    calls.push({ url, init })
    const handler = routes[url.pathname]
    if (handler === undefined) return new Response('{}', { status: 404 })
    const body = typeof handler === 'function' ? handler(url, init) : handler
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}

/** Accessibility violations axe finds in a container (WCAG 2.x A/AA rules). */
export async function axeViolations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    // jsdom has no layout engine, so colour contrast can't be computed here.
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
}

// --- Fixtures in the contract's shape ---------------------------------------------------------

export const STATUS_OK: StatusResponse = {
  health: 'ok',
  observedAt: '2026-10-28T12:00:00.000Z',
  ageSeconds: 600,
  maxAgeSeconds: 46_800,
  fetchedAt: '2026-10-28T12:09:00.000Z',
  lastError: null,
  devices: {},
  demo: false,
}

const L1: LegView = {
  mode: 'metro',
  durationSeconds: 300,
  line: 'L1',
  label: 'Línea 1',
  color: '#e1261c',
  textColor: '#ffffff',
  headsign: 'San Pablo',
  expressRoute: null,
  from: { name: 'Universidad de Chile', lat: -33.444, lng: -70.6495 },
  to: { name: 'Los Héroes', lat: -33.4458, lng: -70.6605 },
  stopCount: 2,
  path: [],
}

export const ROUTE_OK: RouteView = {
  source: 'primary',
  verdict: { kind: 'ok', findings: [] },
  durationSeconds: 1500,
  legs: [
    { mode: 'walk', durationSeconds: 270, path: [] },
    L1,
    { mode: 'walk', durationSeconds: 90, path: [] },
  ],
}

export const ROUTE_BLOCKED: RouteView = {
  source: 'primary',
  verdict: {
    kind: 'blocked',
    findings: [
      {
        effect: 'blocked',
        legIndex: 1,
        stationName: 'Los Héroes',
        reason: { code: 'elevator-out', stationId: 'LH', deviceId: 'LH-60d634', platform: 'yours' },
      },
    ],
  },
  durationSeconds: 1500,
  legs: [L1],
}

export const plan = (overrides: Partial<PlanResponse> = {}): PlanResponse => ({
  outcome: 'accessible',
  rerouted: false,
  routes: [ROUTE_OK],
  status: { health: 'ok', observedAt: '2026-10-28T12:00:00.000Z', demo: false },
  ...overrides,
})
