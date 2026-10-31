import type { RouteView, StatusResponse } from '@rutalibre/contract'
import { loadRegistry } from '@rutalibre/registry'
import {
  APIProvider,
  ControlPosition,
  Map as GoogleMap,
  InfoWindow,
  MapControl,
} from '@vis.gl/react-google-maps'
import { useMemo, useState } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { CloseIcon } from '../../shared/icons.tsx'
import { MapButtons } from './MapButtons.tsx'
import { MetroLines, RoutePath, StationDots } from './overlays.tsx'
import { StationDetails } from './StationDetails.tsx'
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
  const registry = loadRegistry()
  const markers = useMemo(() => stationMarkers(registry, status), [registry, status])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = registry.stations.find((s) => s.id === selectedId)
  const close = () => setSelectedId(null)
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
        // Tapping the map anywhere else closes the station card.
        onClick={close}
        {...(mapId ? { mapId } : { styles: QUIET_STYLE })}
      >
        <MetroLines dimmed={route !== undefined} />
        <StationDots markers={markers} focus={focus} onSelect={setSelectedId} />
        {selected && (
          // Our own header instead of Google's: its close button is small and easy to miss,
          // and on some phones it didn't show at all. Ours is a 44 px target with a label.
          <InfoWindow position={selected.location} headerDisabled onClose={close} maxWidth={320}>
            <div className="station-card__header">
              <h2 className="station-card__name">{selected.name}</h2>
              <button type="button" className="station-card__close" onClick={close}>
                <CloseIcon />
                <span className="visually-hidden">{t('station.close')}</span>
              </button>
            </div>
            <StationDetails station={selected} registry={registry} status={status} />
          </InfoWindow>
        )}
        <RoutePath route={route} />
        <MapControl position={ControlPosition.RIGHT_BOTTOM}>
          <MapButtons route={route} />
        </MapControl>
      </GoogleMap>
    </APIProvider>
  )
}
