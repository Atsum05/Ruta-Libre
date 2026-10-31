import type { ErrorResponse } from '@rutalibre/contract'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { UpstreamError } from '../http/request.ts'
import type { Logger } from '../log.ts'

export type AppEnv = { Variables: { requestId: string } }

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/

/**
 * Gives every request an ID (reusing a well-formed incoming X-Request-Id), returns it in the
 * response, and logs one line per request. Paths only: query strings and bodies can hold
 * places and free text, which are personal data (DATA_SOURCES.md, Ley 21.719).
 */
export function requestLogging(log: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id')
    const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID()
    c.set('requestId', requestId)
    c.header('X-Request-Id', requestId)
    const started = performance.now()
    await next()
    log.info('request', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
    })
  }
}

export function errorBody(
  c: Context<AppEnv>,
  code: ErrorResponse['error']['code'],
  message: string,
): ErrorResponse {
  return { error: { code, message }, requestId: c.get('requestId') ?? 'unknown' }
}

/** Every error leaves as the contract's JSON shape; internals never leak to the client. */
export function errorHandler(log: Logger) {
  return (err: Error, c: Context<AppEnv>) => {
    if (err instanceof HTTPException) {
      return c.json(
        errorBody(c, err.status === 400 ? 'bad-request' : 'internal', err.message),
        err.status,
      )
    }
    if (err instanceof UpstreamError) {
      log.warn('upstream failed', {
        requestId: c.get('requestId'),
        error: err.message,
        status: err.status,
      })
      return c.json(
        errorBody(c, 'upstream-failed', 'An external service failed. Try again shortly.'),
        502,
      )
    }
    log.error('unhandled error', {
      requestId: c.get('requestId'),
      error: err.message,
      stack: err.stack,
    })
    return c.json(errorBody(c, 'internal', 'Something went wrong.'), 500)
  }
}
