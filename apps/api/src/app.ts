import type { Registry } from '@rutalibre/core'
import { type Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import pkg from '../package.json' with { type: 'json' }
import type { Config } from './config.ts'
import { jsonLogger, type Logger } from './log.ts'
import { type AppEnv, errorBody, errorHandler, requestLogging } from './middleware/observability.ts'
import { clientKeyFrom, rateLimit } from './middleware/rate-limit.ts'
import type { LanguageProvider, PlacesProvider, RoutingProvider } from './providers.ts'
import { openApiRoutes } from './routes/openapi.ts'
import { statusRoutes } from './routes/status.ts'
import { tripRoutes } from './routes/trip.ts'
import type { SnapshotStore } from './status/store.ts'

export interface AppDeps {
  readonly config: Config
  readonly statusStore: Pick<SnapshotStore, 'get'>
  readonly registry?: Registry
  readonly routing?: RoutingProvider | null
  readonly places?: PlacesProvider | null
  readonly language?: LanguageProvider | null
  readonly now?: () => number
  readonly log?: Logger
  /** The TCP peer address (from the Node server); absent in tests. */
  readonly socketAddress?: (c: Context<AppEnv>) => string | undefined
}

const MINUTE = 60_000
/** Requests per client per minute. Plan and interpret cost money upstream; keep them tight. */
const LIMITS = { '/v1/plan': 20, '/v1/places': 60, '/v1/interpret': 10, '/v1/status': 60 }

// Built from injected dependencies rather than globals, so tests can use any config and fakes.
export function createApp(deps: AppDeps) {
  const { config, statusStore, registry, now = Date.now, log = jsonLogger } = deps
  const app = new Hono<AppEnv>()

  app.use('*', requestLogging(log))
  app.onError(errorHandler(log))
  app.notFound((c) => c.json(errorBody(c, 'not-found', 'No such endpoint.'), 404))

  // Production is same-origin through the Netlify proxy; CORS only opens listed origins.
  app.use('/v1/*', cors({ origin: config.corsOrigins, allowMethods: ['GET', 'POST'], maxAge: 600 }))

  const clientKey = clientKeyFrom(config.trustProxy, deps.socketAddress ?? (() => undefined))
  for (const [path, limit] of Object.entries(LIMITS)) {
    app.use(path, rateLimit({ limit, windowMs: MINUTE, clientKey, now }))
  }

  app.get('/v1/health', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({
      status: 'ok' as const,
      version: pkg.version,
      commit: config.commit,
      env: config.env,
    })
  })

  app.route('/', statusRoutes({ store: statusStore, maxAgeMs: config.status.maxAgeMs, now }))
  app.route('/', openApiRoutes(pkg.version))
  app.route(
    '/',
    tripRoutes({
      plan:
        deps.routing && registry
          ? {
              routing: deps.routing,
              statusStore,
              registry,
              maxAgeMs: config.status.maxAgeMs,
              now,
              log,
            }
          : null,
      places: deps.places ?? null,
      language: deps.language ?? null,
    }),
  )

  return app
}

export const USER_AGENT = `RutaLibre/${pkg.version} (+https://github.com/Atsum05/Ruta-Libre)`
