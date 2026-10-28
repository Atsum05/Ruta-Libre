import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps'

// Plaza de Armas, roughly the centre of the Metro network.
const SANTIAGO = { lat: -33.4378, lng: -70.6505 }

interface MapCanvasProps {
  apiKey: string
  mapId: string | undefined
}

// Owns the Google Maps lifecycle (ADR 0009). Overlays (Metro lines, device status, the route)
// get added here as declarative children, so the map library stays behind this one component.
export function MapCanvas({ apiKey, mapId }: MapCanvasProps) {
  return (
    <APIProvider apiKey={apiKey} language="es-419" region="CL">
      <GoogleMap
        className="map"
        defaultCenter={SANTIAGO}
        defaultZoom={12}
        // The map fills the screen, so one-finger panning shouldn't require two fingers.
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        {...(mapId ? { mapId } : {})}
      />
    </APIProvider>
  )
}
