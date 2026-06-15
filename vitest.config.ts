import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage/vitest',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        // Type-only declarations do not emit executable statements for runtime coverage.
        'packages/core/src/json.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 90,
        lines: 80,
      },
    },
  },
});
