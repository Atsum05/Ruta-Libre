import { defineConfig } from 'vitest/config'

// Each package and app is its own Vitest project, so `pnpm test` at the root runs everything.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      // The verdict is the product (roadmap principle 1): core carries the coverage gate.
      include: ['packages/core/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**'],
      reporter: ['text-summary', 'html'],
      thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 },
    },
  },
})
