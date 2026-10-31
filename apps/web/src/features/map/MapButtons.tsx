import type { RouteView } from '@rutalibre/contract'
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useState } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { LocateIcon, RouteIcon } from '../../shared/icons.tsx'
import { routePadding } from './overlays.tsx'

type Locating = 'idle' | 'busy' | 'denied' | 'failed'

/**
 * Map buttons: centre on my location (asked only when tapped, like the search field), and,
 * with a route on screen, zoom back out to the whole route after panning around.
 */
export function MapButtons({ route }: { route: RouteView | undefined }) {
  const map = useMap()
  const { t } = useI18n()
  const [locating, setLocating] = useState<Locating>('idle')
  const [here, setHere] = useState<google.maps.LatLngLiteral | null>(null)

  // A blue dot for "you are here", drawn once the location is known.
  useEffect(() => {
    if (!map || !here) return
    const dot = new google.maps.Marker({
      map,
      position: here,
      clickable: false,
      zIndex: 50,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#1f6fe5',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    })
    return () => dot.setMap(null)
  }, [map, here])

  function locate() {
    if (!navigator.geolocation) {
      setLocating('failed')
      return
    }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setHere(at)
        setLocating('idle')
        map?.panTo(at)
        map?.setZoom(16)
      },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }

  function showRoute() {
    if (!map || !route) return
    const bounds = new google.maps.LatLngBounds()
    for (const leg of route.legs) for (const [lng, lat] of leg.path) bounds.extend({ lat, lng })
    if (!bounds.isEmpty()) map.fitBounds(bounds, routePadding())
  }

  const message =
    locating === 'denied'
      ? t('map.locateDenied')
      : locating === 'failed'
        ? t('map.locateFailed')
        : null

  return (
    <div className="map-buttons">
      {message && (
        <p className="map-buttons__message" role="alert">
          {message}
        </p>
      )}
      {route && (
        <button type="button" className="map-button" onClick={showRoute}>
          <RouteIcon />
          <span className="visually-hidden">{t('map.showRoute')}</span>
        </button>
      )}
      <button
        type="button"
        className="map-button"
        onClick={locate}
        disabled={locating === 'busy'}
        aria-busy={locating === 'busy'}
      >
        <LocateIcon />
        <span className="visually-hidden">{t('map.locate')}</span>
      </button>
    </div>
  )
}
