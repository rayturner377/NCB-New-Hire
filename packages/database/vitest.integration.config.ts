import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@ncb/vitest-config';

/**
 * Integration tests hit the real Dockerized Postgres (see docker-compose.yml) and
 * expect DATABASE_URL to point at the `ncb_medical_test` database, not dev data.
 * Run with: npm run test:integration -w @ncb/database
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.integration.test.ts'],
      testTimeout: 20000,
      // Refuses to run at all unless DATABASE_URL looks like a disposable test database — see the
      // guard's own doc comment for why this exists (a real dev-data audit_events wipe).
      globalSetup: ['./src/test-utils/assert-safe-test-database.ts']
    }
  })
);
