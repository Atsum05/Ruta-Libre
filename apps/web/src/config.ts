import { z } from 'zod'

// Same guard as the API: a BOM or stray whitespace in a pasted key broke the prototype with a
// misleading CORS error, so a malformed value stops the dev server or build instead.
const cleanString = z
  .string()
  .min(1)
  .refine((s) => s === s.trim() && !s.includes('﻿'), {
    error: 'contains a BOM or leading/trailing whitespace',
  })

const WebEnvSchema = z.object({
  // The one key allowed in the browser (ADR 0009): restricted to our domains and the Maps JS API.
  VITE_GOOGLE_MAPS_KEY: cleanString,
  VITE_GOOGLE_MAPS_MAP_ID: cleanString.optional(),
})

export interface WebConfig {
  googleMapsKey: string
  googleMapsMapId: string | undefined
}

export class WebConfigError extends Error {
  override name = 'WebConfigError'
}

/** Validates the VITE_* variables. Called by vite.config.ts (fail fast) and at runtime (typed). */
export function parseWebConfig(env: Record<string, unknown>): WebConfig {
  const result = WebEnvSchema.safeParse(env)
  if (!result.success) {
    throw new WebConfigError(z.prettifyError(result.error))
  }
  return {
    googleMapsKey: result.data.VITE_GOOGLE_MAPS_KEY,
    googleMapsMapId: result.data.VITE_GOOGLE_MAPS_MAP_ID,
  }
}
