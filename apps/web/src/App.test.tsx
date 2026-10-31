// The whole app, wired as in production, against a stubbed API. The map component is replaced
// (Google Maps can't run here; map.test.tsx covers it), so this checks the shell: status,
// search → plan → result, errors, the debug footer, and switching language.

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'
import { plan, ROUTE_BLOCKED, ROUTE_OK, renderApp, STATUS_OK, stubApi } from './test/render.tsx'

vi.mock('./features/map/MapCanvas.tsx', () => ({
  default: ({ route }: { route?: { durationSeconds: number } }) => (
    <div
      data-testid="map"
      data-route={route ? 'shown' : 'none'}
      data-duration={route?.durationSeconds}
    />
  ),
}))

const CONFIG = { googleMapsKey: 'k', googleMapsMapId: undefined }
const HEALTH = { status: 'ok', version: '0.1.0', commit: 'abc1234', env: 'production' }
const PLACES = {
  suggestions: [{ placeId: 'p1', primary: 'Universidad de Chile', secondary: null }],
}

async function chooseBothPlaces(user: ReturnType<typeof userEvent.setup>) {
  for (const field of ['Desde', 'Hasta']) {
    await user.type(screen.getByRole('combobox', { name: field }), 'Univ')
    await user.click(await screen.findByRole('option', { name: 'Universidad de Chile' }))
  }
}

describe('App', () => {
  it('shows the live status, the debug footer, and an empty map', async () => {
    stubApi({ '/api/v1/status': STATUS_OK, '/api/v1/health': HEALTH })
    renderApp(<App config={CONFIG} />)
    expect(await screen.findByText('Estado de ascensores actualizado hace 10 min.')).toBeTruthy()
    expect(await screen.findByText(/api 0\.1\.0 \(abc1234, production\)/)).toBeTruthy()
    expect((await screen.findByTestId('map')).dataset['route']).toBe('none')
  })

  it('plans a trip and draws the best route on the map', async () => {
    const calls = stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan(),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))

    expect(await screen.findByText('Ruta accesible encontrada.')).toBeTruthy()
    expect(screen.getByTestId('map').dataset['route']).toBe('shown')
    const request = calls.find((c) => c.url.pathname === '/api/v1/plan')
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      origin: { kind: 'place', placeId: 'p1' },
      destination: { kind: 'place', placeId: 'p1' },
    })
  })

  it('says so when planning fails', async () => {
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': new Response('{}', { status: 502 }),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    expect(
      await screen.findByText('No pudimos buscar la ruta. Inténtalo de nuevo en un momento.'),
    ).toBeTruthy()
  })

  it('warns when the API itself is unreachable', async () => {
    stubApi({})
    renderApp(<App config={CONFIG} />)
    expect((await screen.findByRole('alert')).textContent).toMatch('No podemos confirmar rutas.')
    expect(await screen.findByText(/api no disponible/)).toBeTruthy()
  })

  it('switches language, remembers it, and updates the page language', async () => {
    stubApi({ '/api/v1/status': STATUS_OK, '/api/v1/health': HEALTH })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('button', { name: 'Find accessible route' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('rutalibre-locale')).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Español' }))
    await waitFor(() => expect(document.documentElement.lang).toBe('es-CL'))
  })

  it('keeps the plan result accessible to the whole trip, not just the map', async () => {
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan({ routes: [ROUTE_OK] }),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    expect(await screen.findByRole('article')).toBeTruthy()
    expect(screen.getByText('Línea 1 dirección San Pablo')).toBeTruthy()
  })
})

describe('App after a result', () => {
  it('folds the search into a one-line summary so the result sits under the map', async () => {
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan(),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    await screen.findByText('Ruta accesible encontrada.')

    const summary = screen.getByRole('region', { name: 'Tu viaje' })
    expect(summary.textContent).toContain('Universidad de Chile')
    expect(screen.queryByRole('button', { name: 'Buscar ruta accesible' })).toBeNull()

    // "Cambiar" reopens the form with the same places.
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByRole('combobox', { name: 'Desde' })).toHaveProperty(
      'value',
      'Universidad de Chile',
    )
    expect(screen.queryByRole('region', { name: 'Tu viaje' })).toBeNull()
  })

  it('draws the route the rider chooses instead of the recommended one', async () => {
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan({ routes: [ROUTE_OK, { ...ROUTE_BLOCKED, durationSeconds: 2400 }] }),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    await screen.findByText('Ruta accesible encontrada.')
    expect(screen.getByTestId('map').dataset['duration']).toBe('1500')

    await user.click(screen.getByText('Otras opciones (1)'))
    await user.click(screen.getByRole('button', { name: 'Ver esta ruta' }))
    expect(screen.getByTestId('map').dataset['duration']).toBe('2400')

    // A new search starts again from the recommended route.
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    await waitFor(() => expect(screen.getByTestId('map').dataset['duration']).toBe('1500'))
  })

  it('starts over with empty fields after "Nueva búsqueda"', async () => {
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan(),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    await screen.findByText('Ruta accesible encontrada.')

    await user.click(screen.getByRole('button', { name: 'Nueva búsqueda' }))
    expect(screen.queryByText('Ruta accesible encontrada.')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Tu viaje' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Desde' })).toHaveProperty('value', '')
    expect(screen.getByTestId('map').dataset['route']).toBe('none')
  })

  it('scrolls back to the map on a phone, so the route is in view', async () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(max-width: 959px)' }))
    stubApi({
      '/api/v1/status': STATUS_OK,
      '/api/v1/health': HEALTH,
      '/api/v1/places': PLACES,
      '/api/v1/plan': plan(),
    })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    await chooseBothPlaces(user)
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    await screen.findByText('Ruta accesible encontrada.')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})

describe('the panel handle on a phone', () => {
  const app = () => document.querySelector('.app')
  const handle = (name: string) => screen.getByRole('button', { name })

  it('lowers the panel to show the whole map when tapped, and raises it again', async () => {
    stubApi({ '/api/v1/status': STATUS_OK, '/api/v1/health': HEALTH })
    const user = userEvent.setup()
    renderApp(<App config={CONFIG} />)
    expect(handle('Ver el mapa completo').getAttribute('aria-expanded')).toBe('true')

    await user.click(handle('Ver el mapa completo'))
    expect(app()?.classList.contains('app--map-open')).toBe(true)
    expect(handle('Mostrar el panel').getAttribute('aria-expanded')).toBe('false')

    await user.click(handle('Mostrar el panel'))
    expect(app()?.classList.contains('app--map-open')).toBe(false)
  })

  it('follows a swipe: down shows the map, up brings the panel back', () => {
    stubApi({ '/api/v1/status': STATUS_OK, '/api/v1/health': HEALTH })
    renderApp(<App config={CONFIG} />)
    const swipe = (name: string, from: number, to: number) => {
      const el = handle(name)
      fireEvent.pointerDown(el, { clientY: from })
      fireEvent.pointerUp(el, { clientY: to })
      // The browser also sends a click at the end of the swipe; it must not undo it.
      fireEvent.click(el)
    }
    swipe('Ver el mapa completo', 100, 180)
    expect(app()?.classList.contains('app--map-open')).toBe(true)
    swipe('Mostrar el panel', 180, 90)
    expect(app()?.classList.contains('app--map-open')).toBe(false)
    // A tiny movement is a tap, not a swipe.
    const el = handle('Ver el mapa completo')
    fireEvent.pointerDown(el, { clientY: 100 })
    fireEvent.pointerUp(el, { clientY: 105 })
    fireEvent.click(el)
    expect(app()?.classList.contains('app--map-open')).toBe(true)
  })
})
