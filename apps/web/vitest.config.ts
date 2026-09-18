import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@ncb/vitest-config';
import { fileURLToPath } from 'node:url';

export default mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
    // tsconfig.json sets jsx: "preserve" for Next.js's own SWC-based JSX handling — Vite 7 (bundled
    // with vitest 5) now transforms .tsx via its own oxc pipeline by default (esbuild's jsx option
    // is ignored once oxc is active) and honors that tsconfig setting strictly, erroring instead of
    // transforming raw JSX itself (e.g. features/notifications/emails/notification-email.tsx, a
    // real .tsx file loaded un-mocked by a few tests). This overrides the JSX transform for
    // Vitest's own test runs only — tsconfig.json/next build are untouched.
    oxc: { jsx: { runtime: 'automatic' } },
    test: {
      include: ['**/*.test.ts', '**/*.test.tsx'],
      environment: 'node',
      coverage: {
        // apps/web has no src/ root (app/, lib/, features/ live at the package
        // root) — override the base config's src/**/*.ts scoping accordingly.
        include: ['lib/**/*.ts', 'features/**/*.ts'],
        exclude: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**', '**/types.ts']
      }
    }
  })
);
