import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchForm } from '../features/search/SearchForm.tsx'
import { renderApp } from '../test/render.tsx'
import { SkyHeader } from './SkyHeader.tsx'
import { greetingAt, santiagoClock, skyAt, useSky } from './sky.ts'

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('santiagoClock', () => {
  it('reads the hour and month in Santiago, whatever the device time zone', () => {
    // Summer time (UTC−3), winter time (UTC−4), and New Year's Eve still in December there.
    expect(santiagoClock(new Date('2026-10-31T23:30:00Z'))).toEqual({ hour: 20, month: 10 })
    expect(santiagoClock(new Date('2026-07-15T12:00:00Z'))).toEqual({ hour: 8, month: 7 })
    expect(santiagoClock(new Date('2027-01-01T02:00:00Z'))).toEqual({ hour: 23, month: 12 })
  })
})

describe('skyAt', () => {
  it.each([
    // Summer (October to March): long evenings.
    [5, 11, 'night'],
    [6, 11, 'dawn'],
    [9, 11, 'day'],
    [18, 11, 'day'],
    [19, 11, 'dusk'],
    [21, 3, 'dusk'],
    [22, 3, 'night'],
    // Winter (April to September): dark soon after six.
    [6, 6, 'night'],
    [7, 6, 'dawn'],
    [10, 6, 'day'],
    [17, 6, 'dusk'],
    [20, 4, 'night'],
  ] as const)('%d:00 in month %d is %s', (hour, month, sky) => {
    expect(skyAt(hour, month)).toBe(sky)
  })
})

describe('greetingAt', () => {
  it.each([
    [4, 'evening'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [19, 'afternoon'],
    [20, 'evening'],
  ] as const)('%d:00 is %s', (hour, greeting) => {
    expect(greetingAt(hour)).toBe(greeting)
  })
})

describe('useSky', () => {
  it('follows the clock in Santiago, and refreshes as time passes', () => {
    vi.useFakeTimers()
    let now = new Date('2026-10-31T21:50:00Z') // 18:50 in Santiago
    const { result } = renderHook(() => useSky(() => now))
    expect(result.current).toEqual({ sky: 'day', greeting: 'afternoon' })

    // Nothing changed: the same state, so nothing re-renders.
    const before = result.current
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current).toBe(before)

    now = new Date('2026-10-31T22:10:00Z') // 19:10: the light turns
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current).toEqual({ sky: 'dusk', greeting: 'afternoon' })
  })

  it('shows the sky asked for in the address, ignoring anything else', () => {
    const noon = () => new Date('2026-10-31T15:00:00Z')
    window.history.replaceState(null, '', '/?sky=night')
    expect(renderHook(() => useSky(noon)).result.current.sky).toBe('night')
    window.history.replaceState(null, '', '/?sky=sunset')
    expect(renderHook(() => useSky(noon)).result.current.sky).toBe('day')
  })
})

describe('SkyHeader', () => {
  it('draws the sky behind its content, as decoration only', () => {
    const { container } = render(
      <SkyHeader sky="dusk">
        <p>RutaLibre</p>
      </SkyHeader>,
    )
    const header = container.querySelector('header')
    expect(header?.dataset['sky']).toBe('dusk')
    expect(screen.getByText('RutaLibre')).toBeTruthy()
    // The mountains, sun, moon and stars are hidden from screen readers.
    for (const art of container.querySelectorAll('.sky__andes, .sky__orb, .sky__stars')) {
      expect(art.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('the greeting above the search', () => {
  it('shows the greeting it is given, and nothing without one', () => {
    const { unmount } = renderApp(
      <SearchForm onSearch={vi.fn()} busy={false} greeting="Buenas tardes" />,
    )
    expect(screen.getByText('Buenas tardes')).toBeTruthy()
    unmount()
    renderApp(<SearchForm onSearch={vi.fn()} busy={false} />)
    expect(document.querySelector('.search__greeting')).toBeNull()
  })
})
