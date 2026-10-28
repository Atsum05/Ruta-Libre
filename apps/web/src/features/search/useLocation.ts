import { useCallback, useState } from 'react'

export type LocationState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'found'; lat: number; lng: number }
  | { kind: 'denied' }
  | { kind: 'failed' }

/**
 * The device location, only when the person asks for it. If it's denied or fails we say so and
 * ask for an origin: the prototype silently used Campus San Joaquín instead (bug #6).
 */
export function useLocation(geolocation: Geolocation | undefined = navigator.geolocation) {
  const [state, setState] = useState<LocationState>({ kind: 'idle' })

  const locate = useCallback(() => {
    if (!geolocation) {
      setState({ kind: 'failed' })
      return
    }
    setState({ kind: 'locating' })
    geolocation.getCurrentPosition(
      (pos) => setState({ kind: 'found', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setState({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }, [geolocation])

  return { state, locate }
}
