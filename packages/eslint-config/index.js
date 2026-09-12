// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config. Consuming packages import this and can append
 * their own overrides, e.g.:
 *   import base from '@ncb/eslint-config';
 *   export default [...base];
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**']
  }
);
