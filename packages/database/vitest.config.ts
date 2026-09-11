import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@ncb/vitest-config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      exclude: ['src/**/*.integration.test.ts']
    }
  })
);
