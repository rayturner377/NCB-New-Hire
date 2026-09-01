import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@ncb/vitest-config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['**/*.test.ts', '**/*.test.tsx'],
      environment: 'node',
      coverage: {
        // apps/web has no src/ root (app/, lib/, features/ live at the package
        // root) — override the base config's src/**/*.ts scoping accordingly.
        include: ['lib/**/*.ts', 'features/**/*.ts'],
        exclude: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**']
      }
    }
  })
);
