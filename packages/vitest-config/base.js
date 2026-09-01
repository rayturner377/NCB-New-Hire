import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest base config. Consuming packages merge this with their own settings, e.g.:
 *   import { mergeConfig, defineConfig } from 'vitest/config';
 *   import base from '@ncb/vitest-config';
 *   export default mergeConfig(base, defineConfig({ test: { include: ['src/**\/*.test.ts'] } }));
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60
      }
    }
  }
});
