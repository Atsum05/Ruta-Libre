import type { Context, MiddlewareHandler } from 'hono'
import { type AppEnv, errorBody } from './observability.ts'

export interface RateLimitOptions {
  /** Requests allowed per client per window. */
  readonly limit: number
  readonly windowMs: number
  /** Who the client is. Behind a trusted proxy, the first X-Forwarded-For address. */
  readonly clientKey: (c: Context<AppEnv>) => string
  readonly now?: () => number
}

/**
 * Fixed-window, per-client rate limiting in memory: enough for one instance (ADR 0008), and it
 * caps how fast one client can spend our Google quota. Move to Key Value with more instances.
 */
export function rateLimit({
  limit,
  windowMs,
  clientKey,
  now = Date.now,
}: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const windows = new Map<string, { start: number; count: number }>()

  return async (c, next) => {
    const t = now()
    const key = clientKey(c)
    let w = windows.get(key)
    if (!w || t - w.start >= windowMs) {
      w = { start: t, count: 0 }
      windows.set(key, w)
      // Forget idle clients so the map can't grow without bound.
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k)
      }
    }
    w.count++
    c.header('RateLimit-Limit', String(limit))
    c.header('RateLimit-Remaining', String(Math.max(0, limit - w.count)))
    if (w.count > limit) {
      c.header('Retry-After', String(Math.ceil((w.start + windowMs - t) / 1000)))
      return c.json(errorBody(c, 'rate-limited', 'Too many requests. Try again in a minute.'), 429)
    }
    return next()
  }
}

/** The client address: the proxy's view when we trust it, otherwise one shared bucket. */
export function clientKeyFrom(
  trustProxy: boolean,
  socketAddress: (c: Context<AppEnv>) => string | undefined,
) {
  return (c: Context<AppEnv>) => {
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      if (forwarded) return forwarded
    }
    return socketAddress(c) ?? 'unknown'
  }
}
