// Contract tests against saved upstream payloads (roadmap phase 5): a real sample, an empty
// object, and malformed bodies. If seguimos.cl changes its format, these say how.

import { DeviceId } from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { UpstreamError } from '../http/request.ts'
import good from './__fixtures__/seguimos-good.json' with { type: 'json' }
import { SeguimosStatusProvider } from './seguimos.ts'

const DAY = 24 * 60 * 60_000

function provider(respond: () => Promise<Response> | Response, seen: Request[] = []) {
  return new SeguimosStatusProvider({
    url: 'https://feed.test/?metro=1&all=1',
    userAgent: 'RutaLibre/test',
    timeoutMs: 1000,
    maxDeviceLagMs: DAY,
    fetchFn: async (input, init) => {
      seen.push(new Request(input, init))
      return respond()
    },
  })
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('SeguimosStatusProvider', () => {
  describe('with a real payload (sample of 2026-10-28)', () => {
    it('dates the snapshot by the newest observation, in Santiago time', async () => {
      const snapshot = await provider(() => json(good)).snapshot()
      // Newest record in this sample: 2026-10-16 20:21:03, Santiago summer time (UTC−3).
      expect(snapshot.observedAt).toBe(Date.parse('2026-10-16T23:21:03Z'))
    })

    it('maps estado 1 to working and anything else to out of service', async () => {
      const { devices } = await provider(() => json(good)).snapshot()
      expect(devices.get(DeviceId('HE-ad0600'))).toBe('working')
      expect(devices.get(DeviceId('HE-0f6a35'))).toBe('out-of-service')
      const out = [...devices.values()].filter((s) => s === 'out-of-service')
      expect(out.length).toBe(7)
    })

    it('drops devices that lag the newest observation by over a day', async () => {
      const { devices } = await provider(() => json(good)).snapshot()
      // Last reported on 6 and 8 October: reading them as current would be a false all-clear.
      expect(devices.has(DeviceId('HSR-1ad32a'))).toBe(false)
      expect(devices.has(DeviceId('LEN-b0a5ba'))).toBe(false)
      expect(devices.size).toBe(Object.keys(good).length - 2)
    })

    it('identifies itself with a User-Agent', async () => {
      const seen: Request[] = []
      await provider(() => json(good), seen).snapshot()
      expect(seen[0]?.headers.get('user-agent')).toBe('RutaLibre/test')
    })
  })

  describe('rejects a bad response instead of guessing', () => {
    it.each([
      ['an empty object', () => json({})],
      [
        'a device with a string estado',
        () => json({ 'X-1': { time: '2026-10-16 20:21:16', estado: '1' } }),
      ],
      ['a list instead of an object', () => json([1, 2, 3])],
      ['only unparseable times', () => json({ 'X-1': { time: 'ayer', estado: 1 } })],
      ['an HTML error page', () => new Response('<html>Bad gateway</html>', { status: 200 })],
      ['an HTTP error', () => json({ error: 'down' }, 503)],
    ])('%s', async (_label, respond) => {
      await expect(provider(respond).snapshot()).rejects.toThrow(UpstreamError)
    })

    it('a network failure or timeout', async () => {
      const failing = provider(() => Promise.reject(new DOMException('timed out', 'TimeoutError')))
      await expect(failing.snapshot()).rejects.toThrow('timed out')
    })
  })
})
