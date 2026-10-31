import type { Finding, RouteView } from '@rutalibre/contract'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { translator } from '../../shared/i18n/index.tsx'
import { axeViolations, plan, ROUTE_BLOCKED, ROUTE_OK, renderApp } from '../../test/render.tsx'
import { describeFinding, orderFindings } from './findings.ts'
import { PlanResult } from './PlanResult.tsx'
import { RouteCard } from './RouteCard.tsx'
import { Steps } from './Steps.tsx'
import { VerdictBadge } from './VerdictBadge.tsx'

const t = translator('es')
const finding = (reason: Finding['reason'], effect: Finding['effect'] = 'warning'): Finding => ({
  effect,
  legIndex: 0,
  reason,
  stationName: 'Los Héroes',
})

describe('VerdictBadge', () => {
  it.each([
    ['ok', '✓', 'Accesible ahora'],
    ['warning', '!', 'Accesible, con avisos'],
    ['blocked', '✕', 'No accesible'],
    ['unknown', '?', 'No podemos confirmarlo'],
  ] as const)('shows %s with an icon and words, not colour alone', (kind, icon, text) => {
    const { container } = renderApp(<VerdictBadge kind={kind} />)
    expect(container.textContent).toBe(`${icon}${text}`)
    // The icon is decorative; the words carry the meaning for screen readers.
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(icon)
  })
})

describe('describeFinding', () => {
  it.each([
    [
      finding({ code: 'elevator-out', stationId: 'LH', deviceId: 'x', platform: 'yours' }),
      'Ascensor fuera de servicio en Los Héroes, en tu andén.',
    ],
    [
      finding({ code: 'elevator-out', stationId: 'LH', deviceId: 'x', platform: 'other' }),
      'Ascensor del andén contrario fuera de servicio en Los Héroes. Probablemente no te afecta.',
    ],
    [
      finding({ code: 'elevator-out', stationId: 'LH', deviceId: 'x', platform: 'uncertain' }),
      'Ascensor fuera de servicio en Los Héroes. No sabemos si es el de tu andén.',
    ],
    [
      finding({ code: 'escalator-out', stationId: 'LH', deviceId: 'x' }),
      'Escalera mecánica fuera de servicio en Los Héroes. El ascensor funciona.',
    ],
    [
      finding({ code: 'elevator-status-missing', stationId: 'LH', deviceId: 'x' }),
      'Sin información de un ascensor en Los Héroes.',
    ],
    [
      finding({ code: 'no-known-elevator', stationId: 'LH' }),
      'No tenemos registro de ascensores en Los Héroes.',
    ],
    [
      finding({ code: 'stop-unmatched', stopName: 'Baquedano' }),
      'No pudimos identificar la estación «Baquedano».',
    ],
    [
      finding({ code: 'status-stale', ageMs: 11 * 86_400_000 }),
      'Los datos de ascensores tienen 11 días de antigüedad: pueden haber cambiado.',
    ],
    [
      finding({ code: 'status-unavailable' }),
      'No hay datos del estado de ascensores en este momento.',
    ],
    [
      finding({ code: 'mode-not-covered', mode: 'rail', line: 'Tren Nos' }),
      'No tenemos datos de accesibilidad para Tren Nos.',
    ],
  ])('%#: explains %j in plain words', (f, text) => {
    expect(describeFinding(f, t)).toBe(text)
  })

  it('still reads when the station name is unknown', () => {
    const f = { ...finding({ code: 'no-known-elevator', stationId: 'X' }), stationName: null }
    expect(describeFinding(f, t)).toBe('No tenemos registro de ascensores en una estación.')
  })
})

describe('orderFindings', () => {
  it('puts the worst first and drops exact repeats', () => {
    const escalator = finding({ code: 'escalator-out', stationId: 'LH', deviceId: 'e' }, 'warning')
    const blocked = finding(
      { code: 'elevator-out', stationId: 'LH', deviceId: 'x', platform: 'yours' },
      'blocked',
    )
    const unknown = finding({ code: 'status-unavailable' }, 'unknown')
    expect(orderFindings([escalator, blocked, unknown, blocked], t).map((f) => f.effect)).toEqual([
      'blocked',
      'unknown',
      'warning',
    ])
  })
})

describe('PlanResult', () => {
  it('shows the best route with its verdict, duration at your pace, and steps', () => {
    renderApp(<PlanResult plan={plan()} />)
    expect(screen.getByRole('status')).toHaveProperty('textContent', 'Ruta accesible encontrada.')
    const card = screen.getByRole('article')
    expect(within(card).getByText('25 min a tu ritmo')).toBeTruthy()
    expect(within(card).getByText('Accesible ahora')).toBeTruthy()
    expect(within(card).getByText('Línea 1 dirección San Pablo')).toBeTruthy()
    expect(within(card).getByText('Caminar ~5 min a tu ritmo')).toBeTruthy()
  })

  it('says the route was adjusted when we rerouted', () => {
    renderApp(<PlanResult plan={plan({ rerouted: true })} />)
    expect(screen.getByRole('status').textContent).toMatch(/Ruta ajustada/)
  })

  it('tells the person to ask for assistance when nothing is accessible, as an alert', () => {
    renderApp(
      <PlanResult plan={plan({ outcome: 'no-accessible-route', routes: [ROUTE_BLOCKED] })} />,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/Pide asistencia/)
    expect(screen.getByText('Ascensor fuera de servicio en Los Héroes, en tu andén.')).toBeTruthy()
  })

  it('makes "unknown" an alert too, never a footnote', () => {
    renderApp(<PlanResult plan={plan({ outcome: 'uncertain' })} />)
    expect(screen.getByRole('alert').textContent).toMatch(/No podemos confirmar/)
  })

  it('collapses the other options', () => {
    renderApp(<PlanResult plan={plan({ routes: [ROUTE_OK, ROUTE_BLOCKED] })} />)
    expect(screen.getByText('Otras opciones (1)').closest('details')?.open).toBe(false)
  })

  it('reports no routes at all', () => {
    renderApp(<PlanResult plan={plan({ outcome: 'no-route', routes: [] })} />)
    expect(screen.getByRole('alert').textContent).toMatch(/No encontramos rutas/)
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('works in English', () => {
    renderApp(<PlanResult plan={plan()} />, 'en')
    expect(screen.getByText('25 min at your pace')).toBeTruthy()
    expect(screen.getByText('Accessible now')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderApp(
      <PlanResult plan={plan({ routes: [ROUTE_OK, ROUTE_BLOCKED] })} />,
    )
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('Steps', () => {
  const base = ROUTE_BLOCKED.legs[0] as Exclude<RouteView['legs'][number], { mode: 'walk' }>
  const leg = (overrides: Partial<typeof base> & { mode?: 'metro' | 'bus' | 'rail' }) =>
    ({ ...base, ...overrides }) as RouteView['legs'][number]
  const stepsOf = (...legs: RouteView['legs']) => {
    renderApp(<Steps legs={legs} />)
    return screen.getAllByRole('listitem').map((li) => li.textContent)
  }

  it('names the bus route and where it goes', () => {
    const [text] = stepsOf(
      leg({ mode: 'bus', line: '210', label: '210', headsign: 'Gran Avenida' }),
    )
    expect(text).toContain('Micro 210 hacia Gran Avenida')
  })

  it('still describes a bus or a train with no direction', () => {
    const texts = stepsOf(
      leg({ mode: 'bus', line: '210', label: '210', headsign: null }),
      leg({ mode: 'metro', headsign: null }),
      leg({ mode: 'rail', line: 'Tren Nos', label: 'Tren Nos', headsign: 'Nos' }),
    )
    expect(texts[0]).toContain('Micro 210')
    expect(texts[1]).toContain('Línea 1')
    expect(texts[2]).toContain('Tren Nos')
  })

  it('shows the express route as a labelled chip', () => {
    const [text] = stepsOf(leg({ expressRoute: 'roja' }))
    expect(text).toContain('Ruta Roja')
    expect(screen.getByText('Ruta Roja').className).toContain('express--roja')
  })

  it('omits the stop count when the provider gave none', () => {
    const [text] = stepsOf(leg({ stopCount: null }))
    expect(text).not.toContain('paradas')
  })

  it('shows the line badge in the line colours', () => {
    stepsOf(leg({}))
    const badge = screen.getByText('L1')
    expect(badge.style.background).toBe('rgb(225, 38, 28)')
    expect(badge.style.color).toBe('rgb(255, 255, 255)')
  })
})

describe('RouteCard', () => {
  it('marks a bus-only route', () => {
    renderApp(<RouteCard route={{ ...ROUTE_OK, source: 'bus-only' }} headingId="h" />)
    expect(screen.getByText('Solo micro')).toBeTruthy()
  })
})
