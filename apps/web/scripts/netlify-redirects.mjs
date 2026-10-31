// Writes dist/_redirects so Netlify proxies /api/* to the Render API: the browser sees one
// origin, so no CORS and no API address in the JavaScript (ADR 0008). Run after `vite build`.
// The address comes from the API_ORIGIN environment variable, set in the Netlify dashboard.

import { writeFileSync } from 'node:fs'

/** The _redirects line for an API origin. Throws on anything that isn't a bare https origin. */
export function redirectsFor(origin) {
  let url
  try {
    url = new URL(origin ?? '')
  } catch {
    throw new Error(
      `API_ORIGIN must be a URL like https://rutalibre-api.onrender.com, got "${origin ?? ''}"`,
    )
  }
  if (url.protocol !== 'https:') throw new Error('API_ORIGIN must use https')
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      'API_ORIGIN must be just the origin, with no path (e.g. no /v1 or trailing path)',
    )
  }
  // 200 = proxy (rewrite), not redirect; ! = apply even if a file exists at that path.
  return `/api/*  ${url.origin}/:splat  200!\n`
}

// Only when run as a script (`node scripts/netlify-redirects.mjs`), not when imported by tests.
if (process.argv[1]?.endsWith('netlify-redirects.mjs')) {
  const rules = redirectsFor(process.env.API_ORIGIN)
  writeFileSync(new URL('../dist/_redirects', import.meta.url), rules)
  console.log(`wrote dist/_redirects: ${rules.trim()}`)
}
