import type { RouteView, StatusResponse } from '@rutalibre/contract'
import { loadRegistry } from '@rutalibre/registry'
import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps'
import { useMemo, useState } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { MetroLines, RoutePath, StationDots } from './overlays.tsx'
import { stationMarkers, stationsOnRoute } from './stationStatus.ts'

// Plaza de Armas, roughly the centre of the Metro network.
const SANTIAGO = { lat: -33.4378, lng: -70.6505 }

// A quiet base map so the route and the station colours carry the picture: no shops or Google's
// own transit layer (we draw the Metro ourselves), softer colours. Ignored when a Map ID is set,
// whose style is managed in Google Cloud.
const QUIET_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'geometry', stylers: [{ saturation: -35 }] },
  { featureType: 'water', stylers: [{ color: '#b9d3e6' }] },
]

export interface MapCanvasProps {
  apiKey: string
  mapId: string | undefined
  status: StatusResponse | undefined
  route: RouteView | undefined
}

/**
 * Owns the Google Maps lifecycle (ADR 0009). Overlays are declarative children: they redraw
 * themselves when their data changes, so the map library stays behind this one component.
 * Lazy-loaded: the map is the heaviest part of the app and the search works without it.
 */
export default function MapCanvas({ apiKey, mapId, status, route }: MapCanvasProps) {
  const { t, locale } = useI18n()
  const [failed, setFailed] = useState(false)
  const markers = useMemo(() => stationMarkers(loadRegistry(), status), [status])
  // With a route on screen, everything else steps back (focus mode).
  const focus = useMemo(() => stationsOnRoute(route, markers), [route, markers])

  if (failed) {
    return (
      <div className="map map--failed" role="note">
        {t('map.unavailable')}
      </div>
    )
  }
  return (
    <APIProvider
      apiKey={apiKey}
      language={locale === 'es' ? 'es-419' : 'en'}
      region="CL"
      onError={() => setFailed(true)}
    >
      <GoogleMap
        className="map"
        aria-label={t('map.label')}
        defaultCenter={SANTIAGO}
        defaultZoom={12}
        // The map fills the screen, so one-finger panning shouldn't require two fingers.
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        {...(mapId ? { mapId } : { styles: QUIET_STYLE })}
      >
        <MetroLines dimmed={route !== undefined} />
        <StationDots markers={markers} focus={focus} />
        <RoutePath route={route} />
      </GoogleMap>
    </APIProvider>
  )
}
