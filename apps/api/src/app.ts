import { Hono } from 'hono'
import pkg from '../package.json' with { type: 'json' }
import type { Config } from './config.ts'

// Built from config rather than reading process.env, so tests can create an app with any config.
export function createApp(config: Config) {
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

  return app
}
