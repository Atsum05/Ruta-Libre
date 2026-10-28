import { defineConfig } from 'vitest/config'

// Each package and app is its own Vitest project, so `pnpm test` at the root runs everything.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
})
