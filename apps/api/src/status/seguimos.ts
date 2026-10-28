import { DeviceId, type DeviceState, type StatusSnapshot } from '@rutalibre/core'
import { z } from 'zod'
import type { StatusProvider } from '../providers.ts'
import { parseSantiagoTime } from './santiago-time.ts'

// Only the fields we use are validated; the feed carries more (texto, historico…).
const PayloadSchema = z.record(
  z.string().min(1),
  z.object({
    time: z.string(),
    // 1 = working; anything else = out of service (verified against the feed, prototype lesson).
    estado: z.number(),
  }),
)

export class UpstreamError extends Error {
  override name = 'UpstreamError'
}

export interface SeguimosOptions {
  readonly url: string
  readonly userAgent: string
  readonly timeoutMs: number
  /**
   * A device last reported this long before the newest one is dropped (so it reads as "no
   * status", never as its old state). One device in the feed lagged 10 days in October 2026.
   */
  readonly maxDeviceLagMs: number
  readonly fetchFn?: typeof fetch
}

/** Live status from seguimos.cl (DATA_SOURCES.md): a JSON object keyed by device ID. */
export class SeguimosStatusProvider implements StatusProvider {
  readonly #options: SeguimosOptions

  constructor(options: SeguimosOptions) {
    this.#options = options
  }

  async snapshot(): Promise<StatusSnapshot> {
    const { url, userAgent, timeoutMs, maxDeviceLagMs, fetchFn = fetch } = this.#options
    const res = await fetchFn(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`)
    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new UpstreamError('response is not JSON')
    }
    const parsed = PayloadSchema.safeParse(json)
    if (!parsed.success)
      throw new UpstreamError(`unexpected format: ${parsed.error.issues[0]?.message}`)
    return toSnapshot(parsed.data, maxDeviceLagMs)
  }
}

/** Maps a validated payload to a snapshot dated by the source's newest observation. */
export function toSnapshot(
  payload: z.infer<typeof PayloadSchema>,
  maxDeviceLagMs: number,
): StatusSnapshot {
  const timed = Object.entries(payload).flatMap(([id, d]) => {
    const at = parseSantiagoTime(d.time)
    return at === null ? [] : [{ id, at, estado: d.estado }]
  })
  if (timed.length === 0) throw new UpstreamError('no devices with a valid time')

  const observedAt = Math.max(...timed.map((d) => d.at))
  const devices = new Map<DeviceId, DeviceState>()
  for (const d of timed) {
    if (observedAt - d.at > maxDeviceLagMs) continue
    devices.set(DeviceId(d.id), d.estado === 1 ? 'working' : 'out-of-service')
  }
  return { observedAt, devices }
}
