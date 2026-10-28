import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { loadRegistry } from '@rutalibre/registry'
import { createApp, USER_AGENT } from './app.ts'
import { ConfigError, parseConfig } from './config.ts'
import { GeminiLanguageProvider } from './gemini/interpret.ts'
import { GooglePlacesProvider } from './google/places.ts'
import { GoogleRoutesProvider } from './google/routes.ts'
import { jsonLogger as log } from './log.ts'
import { StatusPoller } from './status/poller.ts'
import { SeguimosStatusProvider } from './status/seguimos.ts'
import { InMemorySnapshotStore, InMemoryStatusHistory } from './status/store.ts'

function loadConfig() {
  try {
    return parseConfig(process.env)
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Refusing to start: invalid configuration\n${err.message}`)
      process.exit(1)
    }
    throw err
  }
}

const config = loadConfig()
const registry = loadRegistry()

// One always-on instance polls (ADR 0008); move to a cron job before running several.
const statusStore = new InMemorySnapshotStore()
const poller = new StatusPoller({
  provider: new SeguimosStatusProvider({
    url: config.status.sourceUrl,
    userAgent: USER_AGENT,
    timeoutMs: config.status.timeoutMs,
    maxDeviceLagMs: 24 * 60 * 60_000,
  }),
  store: statusStore,
  history: new InMemoryStatusHistory(),
  log,
})
poller.start(config.status.pollMs)

const google = config.googleMapsKey
  ? { apiKey: config.googleMapsKey, timeoutMs: config.upstreamTimeoutMs }
  : null
if (!google) log.warn('GOOGLE_MAPS_API_KEY not set: /v1/plan and /v1/places return 503')

const app = createApp({
  config,
  statusStore,
  registry,
  routing: google && new GoogleRoutesProvider(google),
  places: google && new GooglePlacesProvider(google),
  language:
    config.gemini &&
    new GeminiLanguageProvider({ ...config.gemini, timeoutMs: config.upstreamTimeoutMs }),
  log,
  socketAddress: (c) => {
    try {
      return getConnInfo(c).remote.address
    } catch {
      return undefined
    }
  },
})

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  log.info('api listening', {
    port: info.port,
    env: config.env,
    commit: config.commit,
    stations: registry.stations.length,
  })
})

// Hosts stop instances with SIGTERM; finish in-flight requests before exiting.
process.on('SIGTERM', () => {
  poller.stop()
  server.close(() => process.exit(0))
})
