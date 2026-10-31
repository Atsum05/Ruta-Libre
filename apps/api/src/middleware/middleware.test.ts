import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonLogger, silentLogger } from '../log.ts'
import { type AppEnv, errorHandler, requestLogging } from './observability.ts'
import { clientKeyFrom, rateLimit } from './rate-limit.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rateLimit', () => {
  function limited(options: { limit: number; clock: { t: number }; key?: string }) {
    return new Hono<AppEnv>()
      .use('*', requestLogging(silentLogger))
      .use(
        '*',
        rateLimit({
          limit: options.limit,
          windowMs: 60_000,
          clientKey: (c) => c.req.header('x-client') ?? 'one',
          now: () => options.clock.t,
        }),
      )
      .get('/', (c) => c.text('ok'))
  }

  it('counts down and resets after the window', async () => {
    const clock = { t: 0 }
    const app = limited({ limit: 2, clock })
    expect((await app.request('/')).headers.get('ratelimit-remaining')).toBe('1')
    expect((await app.request('/')).status).toBe(200)
    const blocked = await app.request('/')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('60')
    clock.t = 60_000
    expect((await app.request('/')).status).toBe(200)
  })

  it('keeps clients apart', async () => {
    const app = limited({ limit: 1, clock: { t: 0 } })
    await app.request('/', { headers: { 'x-client': 'a' } })
    expect((await app.request('/', { headers: { 'x-client': 'b' } })).status).toBe(200)
  })

  it('forgets idle clients so memory stays bounded', async () => {
    const clock = { t: 0 }
    const app = limited({ limit: 1, clock })
    for (let i = 0; i <= 10_000; i++) await app.request('/', { headers: { 'x-client': `c${i}` } })
    clock.t = 60_000
    // A new client after the window triggers the sweep; old clients start fresh afterwards.
    await app.request('/', { headers: { 'x-client': 'new' } })
    expect((await app.request('/', { headers: { 'x-client': 'c1' } })).status).toBe(200)
  })
})

describe('clientKeyFrom', () => {
  const keyFor = async (trustProxy: boolean, headers: Record<string, string>, socket?: string) => {
    let key = ''
    const app = new Hono<AppEnv>().get('/', (c) => {
      key = clientKeyFrom(trustProxy, () => socket)(c)
      return c.text('')
    })
    await app.request('/', { headers })
    return key
  }

  it('uses the first X-Forwarded-For address behind a trusted proxy', async () => {
    expect(await keyFor(true, { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }, '10.0.0.1')).toBe(
      '200.1.2.3',
    )
  })

  it('ignores X-Forwarded-For unless the proxy is trusted (it is easy to fake)', async () => {
    expect(await keyFor(false, { 'x-forwarded-for': '1.2.3.4' }, '10.0.0.9')).toBe('10.0.0.9')
  })

  it('falls back to the socket, then to one shared bucket', async () => {
    expect(await keyFor(true, {}, '10.0.0.9')).toBe('10.0.0.9')
    expect(await keyFor(false, {})).toBe('unknown')
  })
})

describe('errorHandler', () => {
  it('turns an HTTP exception into the contract error shape', async () => {
    const app = new Hono<AppEnv>()
      .use('*', requestLogging(silentLogger))
      .get('/bad', () => {
        throw new HTTPException(400, { message: 'nope' })
      })
      .get('/teapot', () => {
        throw new HTTPException(418, { message: 'short and stout' })
      })
    app.onError(errorHandler(silentLogger))
    const bad = await app.request('/bad')
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ error: { code: 'bad-request', message: 'nope' } })
    expect(await (await app.request('/teapot')).json()).toMatchObject({
      error: { code: 'internal' },
    })
  })
})

describe('jsonLogger', () => {
  it('writes one JSON object per line, errors to stderr', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    jsonLogger.info('hello', { a: 1 })
    jsonLogger.warn('careful')
    jsonLogger.error('broken', { code: 'X' })
    expect(JSON.parse(String(out.mock.calls[0]?.[0]))).toMatchObject({
      level: 'info',
      msg: 'hello',
      a: 1,
    })
    expect(JSON.parse(String(out.mock.calls[1]?.[0]))).toMatchObject({
      level: 'warn',
      msg: 'careful',
    })
    expect(JSON.parse(String(err.mock.calls[0]?.[0]))).toMatchObject({ level: 'error', code: 'X' })
    expect(JSON.parse(String(out.mock.calls[0]?.[0])).time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
