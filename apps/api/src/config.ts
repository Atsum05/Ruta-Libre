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
})

export interface Config {
  port: number
  env: 'local' | 'preview' | 'production'
  commit: string
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
  }
}
