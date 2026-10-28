import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so tests don't need a Google Maps key.
export default defineConfig({
  test: {
    name: 'web',
  },
})
