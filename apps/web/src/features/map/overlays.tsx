import type { RouteView } from '@rutalibre/contract'
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useState } from 'react'
import { MARKER_COLOR } from './colors.ts'
import { MARKER_ORDER, type StationMarker } from './stationStatus.ts'

const INK = '#121a2e'
const SIGNAL = '#ffc83d'

/**
 * The Metro network from OpenStreetMap (ODbL: credited under the map). With a route on screen
 * the network fades back, so the route is what you see.
 */
export function MetroLines({ dimmed = false }: { dimmed?: boolean }) {
  const map = useMap()
  const [layer, setLayer] = useState<google.maps.Data | null>(null)

  useEffect(() => {
    if (!map) return
    const data = new google.maps.Data({ map })
    void data.loadGeoJson('/data/metro_lineas.geojson')
    setLayer(data)
    return () => data.setMap(null)
  }, [map])

  useEffect(() => {
    layer?.setStyle((f) => ({
      strokeColor: String(f.getProperty('color') ?? '#888'),
      strokeWeight: dimmed ? 3 : 4,
      strokeOpacity: dimmed ? 0.18 : 0.85,
      clickable: false,
      zIndex: 1,
    }))
  }, [layer, dimmed])
  return null
}

/**
 * One dot per station, coloured by status, worst drawn on top. With a route on screen, only the
 * route's stations keep a full-size dot; the rest shrink to faint context.
 */
export function StationDots({
  markers,
  focus,
  onSelect,
}: {
  markers: readonly StationMarker[]
  /** Station IDs on the current route, or null when no route is shown. */
  focus: ReadonlySet<string> | null
  /** Called with the station ID when its dot is tapped. */
  onSelect?: (id: string) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const dots = markers.map((m) => {
      const inFocus = focus === null || focus.has(m.id)
      const dot = new google.maps.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.name,
        clickable: onSelect !== undefined,
        cursor: 'pointer',
        zIndex: (inFocus ? 20 : 2) + MARKER_ORDER[m.status],
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: !inFocus ? 3 : focus ? 8 : m.status === 'ok' ? 5 : 7,
          fillColor: MARKER_COLOR[m.status],
          fillOpacity: inFocus ? 1 : 0.35,
          strokeColor: '#ffffff',
          strokeWeight: inFocus ? 2 : 0,
        },
      })
      if (onSelect) dot.addListener('click', () => onSelect(m.id))
      return dot
    })
    return () => {
      for (const d of dots) d.setMap(null)
    }
  }, [map, markers, focus, onSelect])
  return null
}

/**
 * Room around the route when zooming to it. On desktop the panel floats over the left of the
 * map, so the route is kept clear of it; on a phone the sheet overlaps the map's bottom edge.
 */
export function routePadding(): google.maps.Padding {
  const desktop =
    typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 960px)').matches
  return desktop
    ? { top: 56, right: 56, bottom: 56, left: 432 + 16 + 56 }
    : { top: 40, right: 40, bottom: 64, left: 40 }
}

/** A ring marker, like the station dots in the itinerary. */
function ring(
  map: google.maps.Map,
  at: google.maps.LatLngLiteral,
  fill: string,
  stroke: string,
  scale: number,
) {
  return new google.maps.Marker({
    map,
    position: at,
    clickable: false,
    zIndex: 40,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: fill,
      fillOpacity: 1,
      strokeColor: stroke,
      strokeWeight: 3,
    },
  })
}

/**
 * The chosen route, drawn to stand out: each ride in its line colour on a wide white casing,
 * walking as dark dots, a ring where you board or get off, and the start and end marked the
 * same way as in the search card (open circle → yellow circle).
 */
export function RoutePath({ route }: { route: RouteView | undefined }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !route) return
    const shapes: { setMap(map: google.maps.Map | null): void }[] = []
    const bounds = new google.maps.LatLngBounds()
    const ends: google.maps.LatLngLiteral[] = []

    for (const leg of route.legs) {
      const path = leg.path.map(([lng, lat]) => ({ lat, lng }))
      for (const p of path) bounds.extend(p)
      if (path.length > 0)
        ends.push(path[0] as google.maps.LatLngLiteral, path.at(-1) as google.maps.LatLngLiteral)
      if (leg.mode === 'walk') {
        shapes.push(
          new google.maps.Polyline({
            map,
            path,
            strokeOpacity: 0,
            zIndex: 30,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 3.5,
                  fillColor: INK,
                  fillOpacity: 1,
                  strokeWeight: 0,
                },
                repeat: '11px',
              },
            ],
          }),
        )
      } else {
        // A wide white casing keeps the ride readable over streets and the faded network.
        shapes.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: '#ffffff',
            strokeWeight: 12,
            zIndex: 30,
          }),
        )
        shapes.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: leg.color,
            strokeWeight: 7,
            zIndex: 31,
          }),
        )
        shapes.push(ring(map, { lat: leg.from.lat, lng: leg.from.lng }, '#ffffff', leg.color, 6))
        shapes.push(ring(map, { lat: leg.to.lat, lng: leg.to.lng }, '#ffffff', leg.color, 6))
      }
    }

    const [start, end] = [ends[0], ends.at(-1)]
    if (start) shapes.push(ring(map, start, '#ffffff', INK, 8))
    if (end) shapes.push(ring(map, end, SIGNAL, INK, 8))
    if (!bounds.isEmpty()) map.fitBounds(bounds, routePadding())
    return () => {
      for (const s of shapes) s.setMap(null)
    }
  }, [map, route])
  return null
}
