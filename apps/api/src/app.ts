import { Hono } from 'hono'
import pkg from '../package.json' with { type: 'json' }
import type { Config } from './config.ts'
import { statusRoutes } from './routes/status.ts'
import type { SnapshotStore } from './status/store.ts'

export interface AppDeps {
  readonly config: Config
  readonly statusStore: Pick<SnapshotStore, 'get'>
  readonly now?: () => number
}

// Built from injected dependencies rather than globals, so tests can use any config and fakes.
export function createApp({ config, statusStore, now = Date.now }: AppDeps) {
  const app = new Hono()

  app.get('/v1/health', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({
      status: 'ok',
      version: pkg.version,
      commit: config.commit,
      env: config.env,
    })
  })

  app.route('/', statusRoutes({ store: statusStore, maxAgeMs: config.status.maxAgeMs, now }))

  return app
}

export const USER_AGENT = `RutaLibre/${pkg.version} (+https://github.com/Atsum05/Ruta-Libre)`
