import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

export const PORT = 4173
export const ORIGIN = `http://127.0.0.1:${PORT}`

/**
 * Serves the production bundle that `pnpm test:e2e` builds first, in this process. Playwright's
 * webServer option runs a child process instead, and stopping that took minutes on Windows.
 * Returning a function makes it the global teardown.
 */
export default async function serve() {
  const server = await preview({
    root: fileURLToPath(new URL('..', import.meta.url)),
    mode: 'e2e',
    preview: { host: '127.0.0.1', port: PORT, strictPort: true },
    logLevel: 'warn',
  })
  return async () => {
    await server.close()
  }
}
