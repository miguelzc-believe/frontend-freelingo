import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}',
        'scripts/crap.ts',
        'scripts/dead-code.ts',
        'scripts/quality.ts',
      ],
      exclude: ['src/routeTree.gen.ts'],
      thresholds: { statements: 48, branches: 44, functions: 43, lines: 49 },
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
