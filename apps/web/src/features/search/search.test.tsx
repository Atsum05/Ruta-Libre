import type { Waypoint } from '@rutalibre/contract'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations, renderApp, stubApi } from '../../test/render.tsx'
import { SearchForm } from './SearchForm.tsx'

const SUGGESTIONS = {
  suggestions: [
    { placeId: 'p-toesca', primary: 'Toesca', secondary: 'Santiago, Chile' },
    { placeId: 'p-toesca-2', primary: 'Metro Toesca', secondary: null },
  ],
}

/** A geolocation that answers once, either with a position or an error code. */
function geolocation(answer: { lat: number; lng: number } | 1 | 2): Geolocation {
  return {
    getCurrentPosition: (ok, fail) => {
      if (typeof answer === 'object') {
        ok({ coords: { latitude: answer.lat, longitude: answer.lng } } as GeolocationPosition)
      } else {
        fail?.({ code: answer, PERMISSION_DENIED: 1 } as GeolocationPositionError)
      }
    },
  } as Geolocation
}

function setup(geo: Geolocation = geolocation(1)) {
  const onSearch = vi.fn<(o: Waypoint, d: Waypoint) => void>()
  const user = userEvent.setup()
  const view = renderApp(<SearchForm onSearch={onSearch} busy={false} geolocation={geo} />)
  return { onSearch, user, ...view }
}

describe('SearchForm', () => {
  it('asks for both places instead of guessing', async () => {
    const { user, onSearch } = setup()
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    expect(screen.getByRole('alert').textContent).toBe('Elige un origen y un destino de la lista.')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('uses the location only when asked, and searches from it', async () => {
    stubApi({ '/api/v1/places': SUGGESTIONS })
    const { user, onSearch } = setup(geolocation({ lat: -33.44, lng: -70.65 }))
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    expect(screen.getByLabelText('Desde')).toHaveProperty('value', 'Mi ubicación')

    await user.type(screen.getByLabelText('Hasta'), 'Toes')
    await user.click(await screen.findByRole('option', { name: 'Toesca, Santiago, Chile' }))
    await user.click(screen.getByRole('button', { name: 'Buscar ruta accesible' }))
    expect(onSearch).toHaveBeenCalledWith(
      { kind: 'point', lat: -33.44, lng: -70.65 },
      { kind: 'place', placeId: 'p-toesca' },
    )
  })

  // Prototype bug #6: a denied location silently became Campus San Joaquín.
  it('says so when location is denied, and leaves the origin empty', async () => {
    const { user } = setup(geolocation(1))
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    expect(screen.getByRole('alert').textContent).toMatch(
      'No tenemos permiso para usar tu ubicación',
    )
    expect(screen.getByLabelText('Desde')).toHaveProperty('value', '')
  })

  it('explains a location failure that is not a denial', async () => {
    const { user } = setup(geolocation(2))
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    expect(screen.getByRole('alert').textContent).toMatch('No pudimos obtener tu ubicación')
  })

  it('works by keyboard: arrows to move, Enter to choose', async () => {
    const calls = stubApi({ '/api/v1/places': SUGGESTIONS })
    const { user } = setup()
    const field = screen.getByLabelText('Hasta')
    await user.type(field, 'Toes')
    await screen.findByRole('option', { name: /Metro Toesca/ })
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(field.getAttribute('aria-activedescendant')).toMatch(/opt-1$/)
    await user.keyboard('{Enter}')
    expect(field).toHaveProperty('value', 'Metro Toesca')
    expect(screen.queryByRole('option')).toBeNull()
    // Each search sends a session token (billing, roadmap phase 6).
    expect(calls[0]?.url.searchParams.get('session')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('closes the suggestions with Escape', async () => {
    stubApi({ '/api/v1/places': SUGGESTIONS })
    const { user } = setup()
    await user.type(screen.getByLabelText('Hasta'), 'Toes')
    await screen.findByRole('option', { name: /Metro Toesca/ })
    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Hasta').getAttribute('aria-expanded')).toBe('false')
  })

  it('says when nothing matches', async () => {
    stubApi({ '/api/v1/places': { suggestions: [] } })
    const { user } = setup()
    await user.type(screen.getByLabelText('Hasta'), 'zzzz')
    expect(
      await screen.findByText('Sin resultados. Prueba con otra dirección o estación.'),
    ).toBeTruthy()
  })

  it('swaps origin and destination', async () => {
    const { user } = setup(geolocation({ lat: -33.44, lng: -70.65 }))
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    await user.click(screen.getByRole('button', { name: 'Intercambiar origen y destino' }))
    expect(screen.getByLabelText('Hasta')).toHaveProperty('value', 'Mi ubicación')
    expect(screen.getByLabelText('Desde')).toHaveProperty('value', '')
  })

  it('fills the fields from free text and searches', async () => {
    stubApi({ '/api/v1/interpret': { origin: 'Metro San Joaquín', destination: 'Metro Toesca' } })
    const { user, onSearch } = setup()
    await user.type(screen.getByLabelText('O describe tu viaje'), 'de San Joaquín a Toesca')
    await user.click(screen.getByRole('button', { name: 'Interpretar' }))
    await waitFor(() => expect(onSearch).toHaveBeenCalled())
    expect(onSearch).toHaveBeenCalledWith(
      { kind: 'address', text: 'Metro San Joaquín' },
      { kind: 'address', text: 'Metro Toesca' },
    )
  })

  it('points back to the fields when free text cannot be understood', async () => {
    stubApi({
      '/api/v1/interpret': new Response(
        JSON.stringify({ error: { code: 'upstream-failed', message: 'x' }, requestId: 'r' }),
        { status: 502 },
      ),
    })
    const { user, onSearch } = setup()
    await user.type(screen.getByLabelText('O describe tu viaje'), 'algo raro')
    await user.click(screen.getByRole('button', { name: 'Interpretar' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos entender el viaje. Usa los campos de arriba.',
    )
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = setup()
    expect(await axeViolations(container)).toEqual([])
  })
})
