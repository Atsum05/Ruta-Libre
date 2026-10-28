import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// End-to-end flows against a mocked API (roadmap phase 7). Google Maps is blocked in the tests,
// so they run without a key and also cover the "map unavailable" fallback.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], locale: 'es-CL' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'es-CL' } },
  ],
  webServer: {
    // The production bundle: closer to what users get, and fast (no on-the-fly compiling).
    command: `vite build && vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env['CI'],
    env: { VITE_GOOGLE_MAPS_KEY: 'e2e-no-real-key' },
  },
})
