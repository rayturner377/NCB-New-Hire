// @ts-check
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import base from '@ncb/eslint-config';

export default [
  ...base,
  reactHooks.configs['recommended-latest'],
  {
    plugins: { '@next/next': nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules }
  },
  {
    files: ['next.config.mjs', 'postcss.config.cjs', 'tailwind.config.cjs'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  { ignores: ['.next/**', 'next-env.d.ts'] }
];
