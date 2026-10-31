import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, STATUS_OK } from '../../test/render.tsx'
import { StatusBanner } from './StatusBanner.tsx'

describe('StatusBanner', () => {
  it('quietly says how fresh the data is when all is well', () => {
    renderApp(<StatusBanner status={STATUS_OK} failed={false} />)
    expect(screen.getByText('Estado de ascensores actualizado hace 10 min.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // The feed stopped on 2026-10-16 (ADR 0012): the person must be told, prominently.
  it('alerts when the source has stopped updating', () => {
    renderApp(
      <StatusBanner
        status={{ ...STATUS_OK, health: 'stale', ageSeconds: 11 * 86_400 }}
        failed={false}
      />,
    )
    expect(screen.getByRole('alert').textContent).toMatch(
      'Los datos de ascensores no se actualizan desde hace 11 días. No podemos confirmar rutas.',
    )
  })

  it('alerts when the last refresh failed, saying how old the data is', () => {
    renderApp(
      <StatusBanner
        status={{ ...STATUS_OK, health: 'degraded', ageSeconds: 3 * 3600, lastError: 'HTTP 503' }}
        failed={false}
      />,
    )
    expect(screen.getByRole('alert').textContent).toMatch('Mostramos datos de hace 3 h.')
  })

  it.each([
    ['there is no data', { ...STATUS_OK, health: 'unavailable' as const }, false],
    ['the API is unreachable', undefined, true],
  ])('alerts when %s', (_label, status, failed) => {
    renderApp(<StatusBanner status={status} failed={failed} />)
    expect(screen.getByRole('alert').textContent).toMatch('No podemos confirmar rutas.')
  })

  it('shows a loading message before the first answer', () => {
    renderApp(<StatusBanner status={undefined} failed={false} />)
    expect(screen.getByText('Cargando estado de ascensores…')).toBeTruthy()
  })
})

describe('StatusBanner in demo mode (ADR 0014)', () => {
  const demo = {
    ...STATUS_OK,
    demo: true,
    observedAt: '2026-10-16T23:21:16.000Z',
    ageSeconds: 14 * 86_400,
  }

  it('says plainly that the data is from a past date, shown as if current', () => {
    renderApp(<StatusBanner status={demo} failed={false} />)
    expect(screen.getByRole('note').textContent).toBe(
      'Modo demo: usamos el estado de ascensores del 16 de octubre como si fuera de hoy, para mostrar cómo funciona RutaLibre.',
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('works in English', () => {
    renderApp(<StatusBanner status={demo} failed={false} />, 'en')
    expect(screen.getByRole('note').textContent).toContain('elevator status from 16 October')
  })

  it('still alerts when there is no data at all', () => {
    renderApp(
      <StatusBanner status={{ ...demo, health: 'unavailable', observedAt: null }} failed={false} />,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
