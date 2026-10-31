// The map draws through Google Maps, which can't run in jsdom. These tests swap in a small fake
// of the google.maps classes we use and check what the overlays ask it to draw.

import type { RouteView, StatusResponse } from '@rutalibre/contract'
import { loadRegistry } from '@rutalibre/registry'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../shared/i18n/index.tsx'
import { ROUTE_OK, STATUS_OK } from '../../test/render.tsx'
import { MARKER_COLOR } from './colors.ts'
import { Legend } from './Legend.tsx'
import { MapButtons } from './MapButtons.tsx'
import MapCanvas from './MapCanvas.tsx'
import { MetroLines, RoutePath, routePadding, StationDots } from './overlays.tsx'
import { StationDetails } from './StationDetails.tsx'
import type { StationMarker } from './stationStatus.ts'

type Options = Record<string, unknown>

const drawn = {
  markers: [] as { opts: Options; map: unknown; listeners?: Record<string, () => void> }[],
  polylines: [] as { opts: Options; map: unknown }[],
  layers: [] as { opts: Options; map: unknown; url?: string; style?: (f: unknown) => Options }[],
}
const fakeMap = { fitBounds: vi.fn(), panTo: vi.fn(), setZoom: vi.fn() }
let lastProviderError: (() => void) | undefined
let lastMapClick: (() => void) | undefined

vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => fakeMap,
  APIProvider: ({ children, onError }: { children: ReactNode; onError: () => void }) => {
    lastProviderError = onError
    return <>{children}</>
  },
  Map: ({
    children,
    'aria-label': label,
    onClick,
  }: {
    children: ReactNode
    'aria-label': string
    onClick?: () => void
  }) => {
    lastMapClick = onClick
    return <section aria-label={label}>{children}</section>
  },
  ControlPosition: { RIGHT_BOTTOM: 9 },
  MapControl: ({ children }: { children: ReactNode }) => <>{children}</>,
  InfoWindow: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
}))

function installFakeGoogle() {
  class Drawable {
    opts: Options
    map: unknown
    listeners: Record<string, () => void> = {}
    constructor(opts: Options, list: { opts: Options; map: unknown }[]) {
      this.opts = opts
      this.map = opts['map']
      list.push(this)
    }
    setMap(map: unknown) {
      this.map = map
    }
    addListener(event: string, fn: () => void) {
      this.listeners[event] = fn
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
  fakeMap.panTo.mockClear()
  fakeMap.setZoom.mockClear()
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
    // Board + alight in the line colour, then start (open) and end (coral), like the search card.
    expect(rings.map((r) => [r['fillColor'], r['strokeColor']])).toEqual([
      ['#ffffff', '#e1261c'],
      ['#ffffff', '#e1261c'],
      ['#ffffff', '#1d1736'],
      ['#ff6b4a', '#1d1736'],
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

describe('StationDetails', () => {
  const registry = loadRegistry()
  const losHeroes = registry.stations.find((s) => s.id === 'LH')
  if (!losHeroes) throw new Error('LH missing from the registry')
  const allWorking = Object.fromEntries(
    losHeroes.devices.map((d) => [d.id, 'working' as const]),
  ) as StatusResponse['devices']
  const card = (status: StatusResponse | undefined) =>
    render(
      <I18nProvider locale="es">
        <StationDetails station={losHeroes} registry={registry} status={status} />
      </I18nProvider>,
    )
  const text = (cls: string) => document.querySelector(cls)?.textContent

  it('lists every device with where it goes and its state, broken ones first', () => {
    card({
      ...STATUS_OK,
      devices: { ...allWorking, 'LH-eba3d6': 'out-of-service', 'LH-093ca8': 'out-of-service' },
    })
    expect(text('.station-card__lines')).toBe('Línea 1')
    expect(text('.station-card__summary')).toBe(
      '1 ascensor fuera de servicio · 1 escalera fuera de servicio',
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    // The broken elevator comes first, then the broken escalator.
    expect(rows[0]?.textContent).toContain('AscensorAndén dirección Los Dominicos')
    expect(rows[0]?.textContent).toContain('Fuera de servicio')
    expect(rows[1]?.textContent).toContain('Escalera mecánica')
    expect(rows[4]?.textContent).toContain('Funciona')
    // The source's own description says which elevator it is.
    expect(screen.getByText(/Ascensor de acceso ubicado en Av. Alameda/)).toBeTruthy()
    expect(text('.station-card__age')).toBe('Estado observado hace 10 min.')
  })

  it('counts several broken devices of one kind', () => {
    card({
      ...STATUS_OK,
      devices: { ...allWorking, 'LH-eba3d6': 'out-of-service', 'LH-60d634': 'out-of-service' },
    })
    expect(text('.station-card__summary')).toBe('2 ascensores fuera de servicio')
  })

  it('says all is well, or that some states are missing', () => {
    const { unmount } = card({ ...STATUS_OK, devices: allWorking })
    expect(text('.station-card__summary')).toBe('Todos los ascensores y escaleras funcionan.')
    unmount()
    const { 'LH-349493': _missing, ...partial } = allWorking
    card({ ...STATUS_OK, devices: partial })
    expect(text('.station-card__summary')).toBe(
      'Sin fallas conocidas, pero falta información de algunos equipos.',
    )
  })

  it('shows old data as the last known state, never as current', () => {
    card({ ...STATUS_OK, devices: allWorking, ageSeconds: 3 * 86_400 })
    expect(text('.station-card__stale')).toBe(
      'Último estado conocido, de hace 3 días: puede haber cambiado.',
    )
  })

  it('labels demo data instead of its age', () => {
    card({ ...STATUS_OK, devices: allWorking, ageSeconds: 3 * 86_400, demo: true })
    expect(document.querySelector('.station-card__stale')).toBeNull()
    expect(text('.station-card__age')).toBe('Datos del modo demo.')
  })

  it('has nothing to say about states without data', () => {
    card(undefined)
    expect(text('.station-card__summary')).toBe('Sin datos del estado de los equipos.')
    expect(screen.getAllByText('Sin información')).toHaveLength(5)
  })
})

describe('MapCanvas station card', () => {
  it('opens the details of a station when its dot is tapped, and closes them', () => {
    render(
      <I18nProvider locale="es">
        <MapCanvas apiKey="k" mapId={undefined} status={STATUS_OK} route={undefined} />
      </I18nProvider>,
    )
    const first = loadRegistry().stations[0]
    act(() => drawn.markers[0]?.listeners?.['click']?.())
    expect(screen.getByRole('dialog').querySelector('h2')?.textContent).toBe(first?.name)
    // Our own close button: Google's was small, and missing on some phones.
    act(() => screen.getByRole('button', { name: 'Cerrar' }).click())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the station details when the map is tapped elsewhere', () => {
    render(
      <I18nProvider locale="es">
        <MapCanvas apiKey="k" mapId={undefined} status={STATUS_OK} route={undefined} />
      </I18nProvider>,
    )
    act(() => drawn.markers[0]?.listeners?.['click']?.())
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => lastMapClick?.())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('MapButtons', () => {
  type Geo = Pick<Geolocation, 'getCurrentPosition'>
  const buttons = (route: RouteView | undefined, geolocation: Geo | undefined) => {
    vi.stubGlobal('navigator', { ...navigator, geolocation })
    return render(
      <I18nProvider locale="es">
        <MapButtons route={route} />
      </I18nProvider>,
    )
  }
  const failWith = (code: number): Geo => ({
    getCurrentPosition: (_ok, fail) =>
      fail?.({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError),
  })
  const locate = () => screen.getByRole('button', { name: 'Centrar en mi ubicación' })

  it('centres on the rider and marks them with a blue dot, asked only when tapped', () => {
    const getCurrentPosition = vi.fn<Geo['getCurrentPosition']>((ok) =>
      ok({ coords: { latitude: -33.45, longitude: -70.66 } } as GeolocationPosition),
    )
    buttons(undefined, { getCurrentPosition })
    expect(getCurrentPosition).not.toHaveBeenCalled()
    act(() => locate().click())
    expect(fakeMap.panTo).toHaveBeenCalledWith({ lat: -33.45, lng: -70.66 })
    expect(fakeMap.setZoom).toHaveBeenCalledWith(16)
    expect(drawn.markers.at(-1)?.opts['position']).toEqual({ lat: -33.45, lng: -70.66 })
  })

  it('explains a refused permission, a failure, and a browser without location', () => {
    const { unmount } = buttons(undefined, failWith(1))
    act(() => locate().click())
    expect(screen.getByRole('alert').textContent).toBe(
      'Activa el permiso de ubicación para centrar el mapa.',
    )
    unmount()
    for (const geo of [failWith(2), undefined]) {
      const view = buttons(undefined, geo)
      act(() => locate().click())
      expect(screen.getByRole('alert').textContent).toBe('No pudimos obtener tu ubicación.')
      view.unmount()
    }
  })

  it('zooms back to the whole route, only when there is one', () => {
    const { unmount } = buttons(undefined, undefined)
    expect(screen.queryByRole('button', { name: 'Ver la ruta completa' })).toBeNull()
    unmount()
    buttons(ROUTE_WITH_PATHS, undefined)
    act(() => screen.getByRole('button', { name: 'Ver la ruta completa' }).click())
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1)
  })
})
