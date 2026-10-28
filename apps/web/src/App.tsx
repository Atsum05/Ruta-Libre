import type { WebConfig } from './config.ts'
import { DebugFooter } from './features/debug/DebugFooter.tsx'
import { MapCanvas } from './features/map/MapCanvas.tsx'

export function App({ config }: { config: WebConfig }) {
  return (
    <div className="app">
      <main className="app-main">
        <h1 className="visually-hidden">RutaLibre</h1>
        <MapCanvas apiKey={config.googleMapsKey} mapId={config.googleMapsMapId} />
      </main>
      <DebugFooter />
    </div>
  )
}
