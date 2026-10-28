import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import pkg from './package.json' with { type: 'json' }
import { parseWebConfig, WebConfigError } from './src/config.ts'

export default defineConfig(({ mode }) => {
  // Refuse to start or build with missing or malformed config (roadmap phase 2).
  try {
    parseWebConfig(loadEnv(mode, import.meta.dirname, 'VITE_'))
  } catch (err) {
    if (err instanceof WebConfigError) {
      throw new Error(`Invalid web configuration (see apps/web/.env.example):\n${err.message}`)
    }
    throw err
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // Netlify sets COMMIT_REF during builds.
      __APP_COMMIT__: JSON.stringify(process.env['COMMIT_REF']?.slice(0, 7) ?? 'local'),
    },
    server: {
      // Mirrors the Netlify `/api/*` → Render rule, so the browser always sees one origin.
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
