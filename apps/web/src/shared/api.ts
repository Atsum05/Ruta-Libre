import { createApiClient } from '@rutalibre/contract'

/** The API, through the same-origin `/api` proxy (Vite in dev, Netlify in production). */
export const api = createApiClient()
