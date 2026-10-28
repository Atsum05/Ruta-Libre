/** An external service failed or answered something we can't use. Maps to HTTP 502. */
export class UpstreamError extends Error {
  override name = 'UpstreamError'
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.status = status
  }
}

export interface RequestJsonOptions {
  readonly timeoutMs: number
  /** Extra attempts after the first, for network errors, 429 and 5xx only. */
  readonly retries?: number
  readonly backoffMs?: number
  readonly fetchFn?: typeof fetch
  readonly sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const retryable = (status: number) => status === 429 || status >= 500

/**
 * Fetches JSON with a hard timeout per attempt and exponential backoff between attempts. Only
 * for requests that are safe to repeat (reads and idempotent queries).
 */
export async function requestJson(
  url: string,
  init: RequestInit,
  {
    timeoutMs,
    retries = 0,
    backoffMs = 200,
    fetchFn = fetch,
    sleep = realSleep,
  }: RequestJsonOptions,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= retries
    let res: Response
    try {
      res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      if (last) throw new UpstreamError(err instanceof Error ? err.message : String(err))
      await sleep(backoffMs * 2 ** attempt)
      continue
    }
    if (!res.ok) {
      if (last || !retryable(res.status)) {
        throw new UpstreamError(`HTTP ${res.status}`, res.status)
      }
      await sleep(backoffMs * 2 ** attempt)
      continue
    }
    try {
      return await res.json()
    } catch {
      throw new UpstreamError('response is not JSON', res.status)
    }
  }
}
