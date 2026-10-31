import { z } from 'zod'

// A value pasted through a shell can pick up an invisible BOM (U+FEFF) or stray whitespace. In the
// prototype that broke an API key and surfaced as a fake CORS error, so we reject it at boot.
const cleanString = z
  .string()
  .min(1)
  .refine((s) => s === s.trim() && !s.includes('﻿'), {
    error: 'contains a BOM or leading/trailing whitespace',
  })

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
    APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
    // Render sets RENDER_GIT_COMMIT; COMMIT_SHA lets any other host or CI provide the same.
    COMMIT_SHA: cleanString.optional(),
    RENDER_GIT_COMMIT: cleanString.optional(),

    // Live status (Phase 5). Polling is from one server, at most once a minute (DATA_SOURCES.md).
    STATUS_SOURCE_URL: z.url().default('https://velocidades.seguimos.cl/?metro=1&all=1'),
    STATUS_POLL_SECONDS: z.coerce.number().int().min(60).max(3600).default(120),
    STATUS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
    // How old the source's newest observation may be before verdicts turn unknown. The feed samples
    // about twice a day, so the default follows that cadence (ADR 0012, proposed).
    STATUS_MAX_AGE_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(7 * 24 * 60)
      .default(13 * 60),
    // Demo mode (ADR 0014): use the last known statuses as if they were current, for showing how
    // the app works while the feed is frozen. The UI labels it; never enable it for real users.
    STATUS_DEMO: z.stringbool().default(false),

    // Trip planning (Phase 6). Server-side keys only (ADR 0004); restrict them to these APIs.
    GOOGLE_MAPS_API_KEY: cleanString.optional(),
    GEMINI_API_KEY: cleanString.optional(),
    GEMINI_MODEL: cleanString.default('gemini-3.1-flash-lite'),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
    // Behind Render's proxy the client address is in X-Forwarded-For; locally it isn't.
    TRUST_PROXY: z.stringbool().default(false),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url())),
  })
  .superRefine((e, ctx) => {
    // Locally you can run without keys (status only); a deployed API must be able to plan.
    if (e.APP_ENV !== 'local' && !e.GOOGLE_MAPS_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_MAPS_API_KEY'],
        message: `required when APP_ENV is ${e.APP_ENV}`,
      })
    }
  })

export interface Config {
  port: number
  env: 'local' | 'preview' | 'production'
  commit: string
  status: {
    /** Demo mode (ADR 0014): treat the last snapshot as current. Never on a public launch. */
    demo: boolean
    sourceUrl: string
    pollMs: number
    timeoutMs: number
    maxAgeMs: number
  }
  googleMapsKey: string | null
  gemini: { apiKey: string; model: string } | null
  upstreamTimeoutMs: number
  trustProxy: boolean
  corsOrigins: string[]
}

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/** Parses the process environment once at startup. Throws ConfigError on anything malformed. */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = EnvSchema.safeParse(env)
  if (!result.success) {
    throw new ConfigError(z.prettifyError(result.error))
  }
  const e = result.data
  return {
    port: e.PORT,
    env: e.APP_ENV,
    commit: e.COMMIT_SHA ?? e.RENDER_GIT_COMMIT ?? 'unknown',
    status: {
      demo: e.STATUS_DEMO,
      sourceUrl: e.STATUS_SOURCE_URL,
      pollMs: e.STATUS_POLL_SECONDS * 1000,
      timeoutMs: e.STATUS_TIMEOUT_MS,
      maxAgeMs: e.STATUS_MAX_AGE_MINUTES * 60_000,
    },
    googleMapsKey: e.GOOGLE_MAPS_API_KEY ?? null,
    gemini: e.GEMINI_API_KEY ? { apiKey: e.GEMINI_API_KEY, model: e.GEMINI_MODEL } : null,
    upstreamTimeoutMs: e.UPSTREAM_TIMEOUT_MS,
    trustProxy: e.TRUST_PROXY,
    corsOrigins: e.CORS_ORIGINS,
  }
}
