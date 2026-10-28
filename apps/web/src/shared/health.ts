import { z } from 'zod'

// Hand-written until Phase 6 generates a typed client from the API's OpenAPI schema.
const HealthSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  commit: z.string(),
  env: z.string(),
})

export type Health = z.infer<typeof HealthSchema>

/** Calls the API through the same-origin `/api` proxy (Vite in dev, Netlify in production). */
export async function fetchHealth(
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Health> {
  const res = await fetchFn('/api/v1/health', signal ? { signal } : {})
  if (!res.ok) {
    throw new Error(`health check failed: HTTP ${res.status}`)
  }
  return HealthSchema.parse(await res.json())
}
