import type { RouteView } from '@rutalibre/contract'
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import { MARKER_COLOR } from './colors.ts'
import { MARKER_ORDER, type StationMarker } from './stationStatus.ts'

/** The Metro network from OpenStreetMap (ODbL: credited under the map). */
export function MetroLines() {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const layer = new google.maps.Data({ map })
    void layer.loadGeoJson('/data/metro_lineas.geojson')
    layer.setStyle((f) => ({
      strokeColor: String(f.getProperty('color') ?? '#888'),
      strokeWeight: 4,
      strokeOpacity: 0.85,
      clickable: false,
    }))
    return () => layer.setMap(null)
  }, [map])
  return null
}

/** One dot per station, coloured by status, worst drawn on top. */
export function StationDots({ markers }: { markers: readonly StationMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const dots = markers.map(
      (m) =>
        new google.maps.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          title: m.name,
          zIndex: MARKER_ORDER[m.status],
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: m.status === 'ok' ? 5 : 7,
            fillColor: MARKER_COLOR[m.status],
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
    )
    return () => {
      for (const d of dots) d.setMap(null)
    }
  }, [map, markers])
  return null
}

/** The chosen route: line colours with a contrasting casing; walking as round dots. */
export function RoutePath({ route }: { route: RouteView | undefined }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !route) return
    const lines: google.maps.Polyline[] = []
    const bounds = new google.maps.LatLngBounds()
    for (const leg of route.legs) {
      const path = leg.path.map(([lng, lat]) => ({ lat, lng }))
      for (const p of path) bounds.extend(p)
      if (leg.mode === 'walk') {
        lines.push(
          new google.maps.Polyline({
            map,
            path,
            strokeOpacity: 0,
            zIndex: 10,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 3,
                  fillColor: '#1f2937',
                  fillOpacity: 1,
                  strokeWeight: 0,
                },
                repeat: '10px',
              },
            ],
          }),
        )
      } else {
        // A white casing keeps the route readable over the Metro network (prototype lesson).
        lines.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: '#ffffff',
            strokeWeight: 9,
            zIndex: 10,
          }),
        )
        lines.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: leg.color,
            strokeWeight: 5,
            zIndex: 11,
          }),
        )
      }
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
    return () => {
      for (const l of lines) l.setMap(null)
    }
  }, [map, route])
  return null
}
