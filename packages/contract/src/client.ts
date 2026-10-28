import type { z } from 'zod'
import {
  ErrorResponseSchema,
  type HealthResponse,
  HealthResponseSchema,
  type InterpretResponse,
  InterpretResponseSchema,
  type PlacesResponse,
  PlacesResponseSchema,
  type PlanRequest,
  type PlanResponse,
  PlanResponseSchema,
  type StatusResponse,
  StatusResponseSchema,
} from './schemas.ts'

export type ApiErrorCode =
  | z.infer<typeof ErrorResponseSchema>['error']['code']
  | 'network'
  | 'invalid-response'

export class ApiError extends Error {
  override name = 'ApiError'
  readonly code: ApiErrorCode
  readonly status: number | null

  constructor(code: ApiErrorCode, message: string, status: number | null) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface ApiClientOptions {
  /** Same-origin proxy prefix: Vite in dev, Netlify in production (ADR 0008). */
  readonly baseUrl?: string
  readonly fetchFn?: typeof fetch
}

export interface ApiClient {
  health(signal?: AbortSignal): Promise<HealthResponse>
  status(signal?: AbortSignal): Promise<StatusResponse>
  plan(request: PlanRequest, signal?: AbortSignal): Promise<PlanResponse>
  places(q: string, session: string, signal?: AbortSignal): Promise<PlacesResponse>
  interpret(text: string, signal?: AbortSignal): Promise<InterpretResponse>
}

/** A typed client for the API: every response is validated against the contract. */
export function createApiClient({
  baseUrl = '/api',
  fetchFn = fetch,
}: ApiClientOptions = {}): ApiClient {
  async function call<S extends z.ZodType>(
    schema: S,
    path: string,
    init: RequestInit,
  ): Promise<z.infer<S>> {
    let res: Response
    try {
      res = await fetchFn(`${baseUrl}${path}`, init)
    } catch (err) {
      if (init.signal?.aborted) throw err
      throw new ApiError('network', err instanceof Error ? err.message : String(err), null)
    }
    const body: unknown = await res.json().catch(() => undefined)
    if (!res.ok) {
      const error = ErrorResponseSchema.safeParse(body)
      throw error.success
        ? new ApiError(error.data.error.code, error.data.error.message, res.status)
        : new ApiError('internal', `HTTP ${res.status}`, res.status)
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      throw new ApiError('invalid-response', `unexpected response from ${path}`, res.status)
    return parsed.data
  }

  const get = (signal?: AbortSignal): RequestInit => (signal ? { signal } : {})
  const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })

  return {
    health: (signal) => call(HealthResponseSchema, '/v1/health', get(signal)),
    status: (signal) => call(StatusResponseSchema, '/v1/status', get(signal)),
    plan: (request, signal) => call(PlanResponseSchema, '/v1/plan', post(request, signal)),
    places: (q, session, signal) =>
      call(PlacesResponseSchema, `/v1/places?${new URLSearchParams({ q, session })}`, get(signal)),
    interpret: (text, signal) =>
      call(InterpretResponseSchema, '/v1/interpret', post({ text }, signal)),
  }
}
