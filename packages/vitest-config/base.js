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
      // Scope measurement to src/ so root-level config files (eslint.config.js,
      // vitest.config.ts, etc.) aren't swept in — setting `exclude` alone would
      // replace Vitest's own default excludes rather than add to them.
      include: ['src/**/*.ts'],
      // Barrel re-exports and type-only files carry no testable logic of their
      // own; counting them drags the ratio down without telling us anything.
      exclude: ['src/index.ts', 'src/types/**', 'src/generated/**', 'src/scripts/**', '**/*.test.ts'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60
      }
    }
  }
});
