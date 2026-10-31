import { defineConfig, devices } from '@playwright/test'
import { ORIGIN } from './e2e/server.ts'

// End-to-end flows against a mocked API (roadmap phase 7). Google Maps is blocked in the tests,
// so they run without a key and also cover the "map unavailable" fallback. Run with
// `pnpm test:e2e`, which builds the bundle that e2e/server.ts serves.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/server.ts',
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], locale: 'es-CL' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'es-CL' } },
  ],
})
