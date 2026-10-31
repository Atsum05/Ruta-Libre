import type { Finding, RouteView } from '@rutalibre/contract'
import { act, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { translator } from '../../shared/i18n/index.tsx'
import { axeViolations, plan, ROUTE_BLOCKED, ROUTE_OK, renderApp } from '../../test/render.tsx'
import { describeFinding, findingDetails, orderFindings } from './findings.ts'
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
    ['ok', 'Accesible ahora'],
    ['warning', 'Accesible, con avisos'],
    ['blocked', 'No accesible'],
    ['unknown', 'No podemos confirmarlo'],
  ] as const)('shows %s with an icon and words, not colour alone', (kind, text) => {
    const { container } = renderApp(<VerdictBadge kind={kind} />)
    // The words carry the meaning for screen readers; the icon is decorative.
    expect(container.textContent).toBe(text)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('gives every verdict a different icon shape', () => {
    const shapes = (['ok', 'warning', 'blocked', 'unknown'] as const).map((kind) => {
      const { container, unmount } = renderApp(<VerdictBadge kind={kind} />)
      const svg = container.querySelector('svg')?.innerHTML
      unmount()
      return svg
    })
    expect(new Set(shapes).size).toBe(4)
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

describe('findingDetails (ADR 0015)', () => {
  const backup = {
    ...finding({
      code: 'elevator-out-backup',
      stationId: 'LH',
      deviceId: 'a',
      backupDeviceId: 'b',
    }),
    deviceDescription: 'Ascensor de acceso Norte hacia Boletería',
    backupDescription: 'Ascensor de acceso Sur hacia Boletería',
  }

  it('says which elevator is out and which one to use instead', () => {
    expect(findingDetails(backup, t)).toEqual([
      'Fuera de servicio: Ascensor de acceso Norte hacia Boletería',
      'Usa este: Ascensor de acceso Sur hacia Boletería',
    ])
  })

  it('shows what it has, and the plain description for other findings', () => {
    const { backupDescription: _b, ...onlyBroken } = backup
    expect(findingDetails(onlyBroken, t)).toEqual([
      'Fuera de servicio: Ascensor de acceso Norte hacia Boletería',
    ])
    const { deviceDescription: _d, ...onlyBackup } = backup
    expect(findingDetails(onlyBackup, t)).toEqual([
      'Usa este: Ascensor de acceso Sur hacia Boletería',
    ])
    const plain = {
      ...finding({ code: 'elevator-out', stationId: 'LH', deviceId: 'a', platform: 'yours' }),
      deviceDescription: 'Ascensor Boletería hacia Andén',
    }
    expect(findingDetails(plain, t)).toEqual(['Ascensor Boletería hacia Andén'])
    expect(findingDetails(finding({ code: 'status-unavailable' }), t)).toEqual([])
  })

  it('shows the details under the finding on the card', () => {
    renderApp(
      <RouteCard
        route={{ ...ROUTE_OK, verdict: { kind: 'warning', findings: [backup] } }}
        headingId="h"
      />,
    )
    expect(screen.getByText(describeFinding(backup, t))).toBeTruthy()
    expect(screen.getByText('Usa este: Ascensor de acceso Sur hacia Boletería')).toBeTruthy()
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
    renderApp(<PlanResult plan={plan()} selected={0} onSelect={() => {}} />)
    expect(screen.getByRole('status')).toHaveProperty('textContent', 'Ruta accesible encontrada.')
    const card = screen.getByRole('article')
    // Shown as a big "25 min" with a smaller "a tu ritmo", read as one heading.
    expect(within(card).getByRole('heading', { level: 3, name: '25 min a tu ritmo' })).toBeTruthy()
    expect(within(card).getByText('Accesible ahora')).toBeTruthy()
    expect(within(card).getByText('Línea 1 dirección San Pablo')).toBeTruthy()
    expect(within(card).getByText('Caminar ~5 min a tu ritmo')).toBeTruthy()
  })

  it('says the route was adjusted when we rerouted', () => {
    renderApp(<PlanResult plan={plan({ rerouted: true })} selected={0} onSelect={() => {}} />)
    expect(screen.getByRole('status').textContent).toMatch(/Ruta ajustada/)
  })

  it('tells the person to ask for assistance when nothing is accessible, as an alert', () => {
    renderApp(
      <PlanResult
        plan={plan({ outcome: 'no-accessible-route', routes: [ROUTE_BLOCKED] })}
        selected={0}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/Pide asistencia/)
    expect(screen.getByText('Ascensor fuera de servicio en Los Héroes, en tu andén.')).toBeTruthy()
  })

  it('makes "unknown" an alert too, never a footnote', () => {
    renderApp(<PlanResult plan={plan({ outcome: 'uncertain' })} selected={0} onSelect={() => {}} />)
    expect(screen.getByRole('alert').textContent).toMatch(/No podemos confirmar/)
  })

  it('collapses the other options', () => {
    renderApp(
      <PlanResult
        plan={plan({ routes: [ROUTE_OK, ROUTE_BLOCKED] })}
        selected={0}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('Otras opciones (1)').closest('details')?.open).toBe(false)
  })

  it('reports no routes at all', () => {
    renderApp(
      <PlanResult
        plan={plan({ outcome: 'no-route', routes: [] })}
        selected={0}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/No encontramos rutas/)
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('works in English', () => {
    renderApp(<PlanResult plan={plan()} selected={0} onSelect={() => {}} />, 'en')
    expect(screen.getByRole('heading', { level: 3, name: '25 min at your pace' })).toBeTruthy()
    expect(screen.getByText('Accessible now')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderApp(
      <PlanResult
        plan={plan({ routes: [ROUTE_OK, ROUTE_BLOCKED] })}
        selected={0}
        onSelect={() => {}}
      />,
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
  it('shows when you leave and arrive, read as a sentence', () => {
    const timed = {
      ...ROUTE_OK,
      departAt: '2026-10-31T18:35:00.000Z',
      arriveAt: '2026-10-31T19:49:00.000Z',
      durationSeconds: 74 * 60,
    }
    renderApp(<RouteCard route={timed} headingId="h" />)
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Sales a las 15:35, llegas a las 16:49. 1 h 14 min a tu ritmo',
    })
    expect(heading.textContent).toBe('15:35 – 16:49 1 h 14 min a tu ritmo')
    expect(screen.getByText(/Horarios estimados/)).toBeTruthy()
  })

  it('shows long walks in hours and minutes', () => {
    renderApp(<Steps legs={[{ mode: 'walk', durationSeconds: 65 * 60, path: [] }]} />)
    expect(screen.getByText('Caminar ~1 h 5 min a tu ritmo')).toBeTruthy()
  })

  it('marks a bus-only route', () => {
    renderApp(<RouteCard route={{ ...ROUTE_OK, source: 'bus-only' }} headingId="h" />)
    expect(screen.getByText('Solo micro')).toBeTruthy()
  })
})

describe('PlanResult in demo mode (ADR 0014)', () => {
  it('labels every verdict as demo data', () => {
    const demoPlan = plan({
      routes: [ROUTE_OK, ROUTE_BLOCKED],
      status: { health: 'ok', observedAt: '2026-10-16T23:21:16.000Z', demo: true },
    })
    renderApp(<PlanResult plan={demoPlan} selected={0} onSelect={() => {}} />)
    expect(screen.getAllByText('Demo')).toHaveLength(2)
  })

  it('shows no demo label for live data', () => {
    renderApp(<PlanResult plan={plan()} selected={0} onSelect={() => {}} />)
    expect(screen.queryByText('Demo')).toBeNull()
  })
})

describe('Steps grammar', () => {
  it('says "1 parada", not "1 paradas"', () => {
    const one = {
      ...(ROUTE_BLOCKED.legs[0] as Exclude<RouteView['legs'][number], { mode: 'walk' }>),
      stopCount: 1,
    }
    renderApp(<Steps legs={[one]} />)
    expect(screen.getByText('1 parada')).toBeTruthy()
  })
})

// A parent holding the choice, as App does.
const SLOW: RouteView = { ...ROUTE_OK, durationSeconds: 3000 }
function Chooser() {
  const [selected, setSelected] = useState(0)
  return (
    <PlanResult
      plan={plan({ routes: [ROUTE_OK, SLOW, ROUTE_BLOCKED] })}
      selected={selected}
      onSelect={setSelected}
    />
  )
}
describe('choosing another route', () => {
  const mainHeading = () => screen.getAllByRole('heading', { level: 3 })[0]

  it('offers each other option, and shows the chosen one as the main route', async () => {
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn())
    renderApp(<Chooser />)
    expect(mainHeading()?.textContent).toBe('25 min a tu ritmo')
    const buttons = screen.getAllByRole('button', { name: 'Ver esta ruta' })
    expect(buttons).toHaveLength(2)

    await act(async () => buttons[0]?.click())
    expect(mainHeading()?.textContent).toBe('50 min a tu ritmo')
    // Focus follows, so a screen reader or a phone lands on the chosen route.
    expect(document.activeElement).toBe(mainHeading())
    expect(screen.getByText('Otras opciones (2)').closest('details')?.open).toBe(false)
    expect(screen.getByText('Estás viendo otra opción.')).toBeTruthy()
    // The recommended route is now among the others, marked as such.
    expect(screen.getByText('Recomendada')).toBeTruthy()

    await act(async () => screen.getByRole('button', { name: 'Volver a la recomendada' }).click())
    expect(mainHeading()?.textContent).toBe('25 min a tu ritmo')
    expect(screen.queryByText('Estás viendo otra opción.')).toBeNull()
    expect(screen.queryByText('Recomendada')).toBeNull()
  })
})
