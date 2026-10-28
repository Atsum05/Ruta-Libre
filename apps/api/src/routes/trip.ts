import { InterpretRequestSchema, PlacesQuerySchema, PlanRequestSchema } from '@rutalibre/contract'
import { Hono } from 'hono'
import { z } from 'zod'
import { type AppEnv, errorBody } from '../middleware/observability.ts'
import { type PlanDeps, planTrip } from '../plan/service.ts'
import type { LanguageProvider, PlacesProvider } from '../providers.ts'

export interface TripRouteDeps {
  /** null when no Google key is configured (local development only; see config). */
  readonly plan: PlanDeps | null
  readonly places: PlacesProvider | null
  readonly language: LanguageProvider | null
}

/** POST /v1/plan, GET /v1/places, POST /v1/interpret. */
export function tripRoutes({ plan, places, language }: TripRouteDeps) {
  const app = new Hono<AppEnv>()

  // Trips, searches and free text are personal: never cache them anywhere.
  app.use('/v1/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })

  app.post('/v1/plan', async (c) => {
    if (!plan)
      return c.json(errorBody(c, 'not-configured', 'Trip planning is not configured.'), 503)
    const parsed = PlanRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success)
      return c.json(errorBody(c, 'bad-request', z.prettifyError(parsed.error)), 400)
    return c.json(await planTrip(plan, parsed.data))
  })

  app.get('/v1/places', async (c) => {
    if (!places)
      return c.json(errorBody(c, 'not-configured', 'Place search is not configured.'), 503)
    const parsed = PlacesQuerySchema.safeParse(c.req.query())
    if (!parsed.success)
      return c.json(errorBody(c, 'bad-request', z.prettifyError(parsed.error)), 400)
    return c.json({ suggestions: await places.search(parsed.data.q, parsed.data.session) })
  })

  app.post('/v1/interpret', async (c) => {
    if (!language) {
      return c.json(errorBody(c, 'not-configured', 'Use the search fields instead.'), 503)
    }
    const parsed = InterpretRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success)
      return c.json(errorBody(c, 'bad-request', z.prettifyError(parsed.error)), 400)
    return c.json(await language.interpret(parsed.data.text))
  })

  return app
}
