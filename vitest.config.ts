import { defineConfig } from 'vitest/config'

// Each package and app is its own Vitest project, so `pnpm test` at the root runs everything.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__fixtures__/**',
        'apps/web/src/test/**',
        '**/*.d.ts',
        // Entry points: only wiring (read env, start servers, write files). They run in
        // `pnpm dev`, the e2e suite and `build:registry`; the logic they call is tested.
        'apps/api/src/server.ts',
        'apps/web/src/main.tsx',
        'packages/registry/src/cli.ts',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: {
        // The whole codebase. Raise these as coverage grows; never lower them to merge.
        lines: 98,
        statements: 97,
        functions: 97,
        branches: 90,
        // The verdict is the product (roadmap principle 1): core carries a stricter gate.
        'packages/core/src/**': { lines: 95, statements: 95, functions: 95, branches: 95 },
      },
    },
  },
})
