import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so tests don't need a Google Maps key.
export default defineConfig({
  define: { __APP_VERSION__: '"test"', __APP_COMMIT__: '"test"' },
  test: {
    name: 'web',
    environment: 'jsdom',
    // Playwright owns e2e/*.spec.ts.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
