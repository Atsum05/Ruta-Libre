import { z } from 'zod'

// A value pasted through a shell can pick up an invisible BOM (U+FEFF) or stray whitespace. In the
// prototype that broke an API key and surfaced as a fake CORS error, so we reject it at boot.
const cleanString = z
  .string()
  .min(1)
  .refine((s) => s === s.trim() && !s.includes('﻿'), {
    error: 'contains a BOM or leading/trailing whitespace',
  })

const EnvSchema = z.object({
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
})

export interface Config {
  port: number
  env: 'local' | 'preview' | 'production'
  commit: string
  status: {
    sourceUrl: string
    pollMs: number
    timeoutMs: number
    maxAgeMs: number
  }
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
      sourceUrl: e.STATUS_SOURCE_URL,
      pollMs: e.STATUS_POLL_SECONDS * 1000,
      timeoutMs: e.STATUS_TIMEOUT_MS,
      maxAgeMs: e.STATUS_MAX_AGE_MINUTES * 60_000,
    },
  }
}
