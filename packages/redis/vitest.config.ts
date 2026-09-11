import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@ncb/vitest-config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      // No unit tests here deliberately: client.ts is a thin ioredis wrapper
      // with nothing meaningful to assert without a live Redis connection —
      // it's verified manually against a real container instead (see the
      // Phase 1 commit).
      passWithNoTests: true
    }
  })
);
