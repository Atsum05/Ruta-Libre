// The map draws through Google Maps, which can't run in jsdom. These tests swap in a small fake
// of the google.maps classes we use and check what the overlays ask it to draw.

import type { RouteView } from '@rutalibre/contract'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../shared/i18n/index.tsx'
import { ROUTE_OK, STATUS_OK } from '../../test/render.tsx'
import { MARKER_COLOR } from './colors.ts'
import { Legend } from './Legend.tsx'
import MapCanvas from './MapCanvas.tsx'
import { MetroLines, RoutePath, routePadding, StationDots } from './overlays.tsx'
import type { StationMarker } from './stationStatus.ts'

type Options = Record<string, unknown>

const drawn = {
  markers: [] as { opts: Options; map: unknown }[],
  polylines: [] as { opts: Options; map: unknown }[],
  layers: [] as { opts: Options; map: unknown; url?: string; style?: (f: unknown) => Options }[],
}
const fakeMap = { fitBounds: vi.fn() }
let lastProviderError: (() => void) | undefined

vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => fakeMap,
  APIProvider: ({ children, onError }: { children: ReactNode; onError: () => void }) => {
    lastProviderError = onError
    return <>{children}</>
  },
  Map: ({ children, 'aria-label': label }: { children: ReactNode; 'aria-label': string }) => (
    <section aria-label={label}>{children}</section>
  ),
}))

function installFakeGoogle() {
  class Drawable {
    opts: Options
    map: unknown
    constructor(opts: Options, list: { opts: Options; map: unknown }[]) {
      this.opts = opts
      this.map = opts['map']
      list.push(this)
    }
    setMap(map: unknown) {
      this.map = map
    }
  }
  class Marker extends Drawable {
    constructor(opts: Options) {
      super(opts, drawn.markers)
    }
  }
  class Polyline extends Drawable {
    constructor(opts: Options) {
      super(opts, drawn.polylines)
    }
  }
  class Data extends Drawable {
    url?: string
    style?: (f: unknown) => Options
    constructor(opts: Options) {
      super(opts, drawn.layers)
    }
    loadGeoJson(url: string) {
      this.url = url
    }
    setStyle(style: (f: unknown) => Options) {
      this.style = style
    }
  }
  class LatLngBounds {
    points: unknown[] = []
    extend(p: unknown) {
      this.points.push(p)
    }
    isEmpty() {
      return this.points.length === 0
    }
  }
  vi.stubGlobal('google', {
    maps: { Marker, Polyline, Data, LatLngBounds, SymbolPath: { CIRCLE: 0 } },
  })
}

beforeEach(() => {
  drawn.markers.length = 0
  drawn.polylines.length = 0
  drawn.layers.length = 0
  fakeMap.fitBounds.mockClear()
  installFakeGoogle()
})

const marker = (id: string, status: StationMarker['status']): StationMarker => ({
  id,
  name: id,
  lat: -33.44,
  lng: -70.65,
  status,
})

describe('StationDots', () => {
  const dots = [marker('A', 'ok'), marker('B', 'blocked'), marker('C', 'unknown')]
  const icon = (i: number) => drawn.markers[i]?.opts['icon'] as Options

  it('draws one dot per station in its status colour, worst on top', () => {
    render(<StationDots markers={dots} focus={null} />)
    expect([0, 1, 2].map((i) => icon(i)['fillColor'])).toEqual([
      MARKER_COLOR.ok,
      MARKER_COLOR.blocked,
      MARKER_COLOR.unknown,
    ])
    const z = drawn.markers.map((m) => m.opts['zIndex'] as number)
    expect(z[1]).toBeGreaterThan(z[2] ?? 0)
    expect(z[2]).toBeGreaterThan(z[0] ?? 0)
  })

  it('keeps the stations on the route prominent and fades the rest (focus mode)', () => {
    render(<StationDots markers={dots} focus={new Set(['B'])} />)
    expect(icon(1)).toMatchObject({ scale: 8, fillOpacity: 1 })
    expect(icon(0)).toMatchObject({ scale: 3, fillOpacity: 0.35 })
    expect(drawn.markers[1]?.opts['zIndex']).toBeGreaterThan(
      drawn.markers[2]?.opts['zIndex'] as number,
    )
  })

  it('removes its dots when the stations change or the map goes away', () => {
    const { rerender, unmount } = render(<StationDots markers={[marker('A', 'ok')]} focus={null} />)
    const first = drawn.markers[0]
    rerender(<StationDots markers={[marker('A', 'blocked')]} focus={null} />)
    expect(first?.map).toBeNull()
    unmount()
    expect(drawn.markers.every((m) => m.map === null)).toBe(true)
  })
})

const ROUTE_WITH_PATHS: RouteView = {
  ...ROUTE_OK,
  legs: [
    {
      mode: 'walk',
      durationSeconds: 120,
      path: [
        [-70.651, -33.443],
        [-70.6495, -33.444],
      ],
    },
    {
      ...(ROUTE_OK.legs[1] as Exclude<RouteView['legs'][number], { mode: 'walk' }>),
      path: [
        [-70.6495, -33.444],
        [-70.6605, -33.4458],
      ],
    },
  ],
}

describe('RoutePath', () => {
  it('draws walking as dots and each ride as a thick line on a wide white casing', () => {
    render(<RoutePath route={ROUTE_WITH_PATHS} />)
    const [walk, casing, line] = drawn.polylines
    expect(walk?.opts).toMatchObject({ strokeOpacity: 0 })
    expect(walk?.opts['icons']).toBeDefined()
    expect(casing?.opts).toMatchObject({ strokeColor: '#ffffff', strokeWeight: 12 })
    expect(line?.opts).toMatchObject({ strokeColor: '#e1261c', strokeWeight: 7 })
    expect((line?.opts['zIndex'] as number) > (casing?.opts['zIndex'] as number)).toBe(true)
  })

  it('rings each station where you board or get off, and marks start and end', () => {
    render(<RoutePath route={ROUTE_WITH_PATHS} />)
    const rings = drawn.markers.map((m) => m.opts['icon'] as Options)
    // Board + alight in the line colour, then start (open) and end (yellow), like the search card.
    expect(rings.map((r) => [r['fillColor'], r['strokeColor']])).toEqual([
      ['#ffffff', '#e1261c'],
      ['#ffffff', '#e1261c'],
      ['#ffffff', '#121a2e'],
      ['#ffc83d', '#121a2e'],
    ])
    expect(drawn.markers.at(-1)?.opts['position']).toEqual({ lat: -33.4458, lng: -70.6605 })
  })

  it('zooms the map to the whole route, clear of the sheet on a phone', () => {
    render(<RoutePath route={ROUTE_WITH_PATHS} />)
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      expect.objectContaining({ points: expect.any(Array) }),
      { top: 40, right: 40, bottom: 64, left: 40 },
    )
  })

  it('keeps the route clear of the floating panel on desktop', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(min-width: 960px)' }))
    expect(routePadding()).toEqual({ top: 56, right: 56, bottom: 56, left: 504 })
  })

  it('draws nothing without a route, and does not move the map', () => {
    render(<RoutePath route={undefined} />)
    expect(drawn.polylines).toEqual([])
    expect(drawn.markers).toEqual([])
    expect(fakeMap.fitBounds).not.toHaveBeenCalled()
  })

  it('does not zoom or mark ends for a route without geometry', () => {
    const walkOnly: RouteView = {
      ...ROUTE_OK,
      legs: [{ mode: 'walk', durationSeconds: 60, path: [] }],
    }
    render(<RoutePath route={walkOnly} />)
    expect(fakeMap.fitBounds).not.toHaveBeenCalled()
    expect(drawn.markers).toEqual([])
  })

  it('clears everything it drew when the route is replaced', () => {
    const { unmount } = render(<RoutePath route={ROUTE_WITH_PATHS} />)
    unmount()
    expect(drawn.polylines.every((p) => p.map === null)).toBe(true)
    expect(drawn.markers.every((m) => m.map === null)).toBe(true)
  })
})

describe('MetroLines', () => {
  const feature = { getProperty: (k: string) => (k === 'color' ? '#fbb800' : undefined) }

  it('loads the OSM line geometry and colours each line', () => {
    const { unmount } = render(<MetroLines />)
    const layer = drawn.layers[0]
    expect(layer?.url).toBe('/data/metro_lineas.geojson')
    expect(layer?.style?.(feature)).toMatchObject({
      strokeColor: '#fbb800',
      strokeOpacity: 0.85,
      clickable: false,
    })
    expect(layer?.style?.({ getProperty: () => undefined })).toMatchObject({ strokeColor: '#888' })
    unmount()
    expect(layer?.map).toBeNull()
  })

  it('fades the network back while a route is shown', () => {
    const { rerender } = render(<MetroLines dimmed={false} />)
    rerender(<MetroLines dimmed />)
    expect(drawn.layers).toHaveLength(1) // restyled, not reloaded
    expect(drawn.layers[0]?.style?.(feature)).toMatchObject({
      strokeOpacity: 0.18,
      strokeWeight: 3,
    })
  })
})

describe('MapCanvas', () => {
  const canvas = () =>
    render(
      <I18nProvider locale="es">
        <MapCanvas apiKey="k" mapId={undefined} status={STATUS_OK} route={ROUTE_WITH_PATHS} />
      </I18nProvider>,
    )

  it('renders a labelled map with the network, the stations and the route', () => {
    canvas()
    expect(screen.getByRole('region', { name: /Mapa de Santiago/ })).toBeTruthy()
    expect(drawn.layers).toHaveLength(1)
    expect(drawn.markers.length).toBeGreaterThan(100) // every registry station
    expect(drawn.polylines.length).toBe(3)
  })

  it('focuses on the route: the network fades and only nearby stations stay large', () => {
    canvas()
    expect(drawn.layers[0]?.style?.({ getProperty: () => '#e1261c' })).toMatchObject({
      strokeOpacity: 0.18,
    })
    const scales = drawn.markers.map((m) => (m.opts['icon'] as Options)['scale'])
    const large = scales.filter((x) => x === 8).length
    expect(large).toBeGreaterThanOrEqual(2) // Universidad de Chile and Los Héroes, per line
    expect(large).toBeLessThan(10)
    expect(scales.filter((x) => x === 3).length).toBeGreaterThan(100)
  })

  it('falls back to a message when Google Maps fails to load', () => {
    canvas()
    act(() => lastProviderError?.())
    expect(screen.getByRole('note').textContent).toBe(
      'El mapa no está disponible. La búsqueda de rutas sigue funcionando.',
    )
  })
})

describe('Legend', () => {
  it('explains every marker colour in words', () => {
    render(
      <I18nProvider locale="es">
        <Legend />
      </I18nProvider>,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ascensores operativos',
      'Solo escalera fuera de servicio',
      'Ascensor fuera de servicio',
      'Sin información',
    ])
  })
})
