import { defineConfig, devices } from '@playwright/test';

/**
 * `channel` picks which installed browser Playwright drives. Left unset, it
 * uses Playwright's own bundled Chromium (`npx playwright install chromium`)
 * — the normal path, and what CI should use. Set PLAYWRIGHT_BROWSER_CHANNEL
 * to 'msedge' or 'chrome' to drive an already-installed browser instead,
 * for any environment where Playwright's own browser download is blocked
 * (e.g. a network-restricted sandbox with no route to cdn.playwright.dev).
 */
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;

// Fixed regardless of whatever PORT a developer's own .env happens to carry
// (this repo's .env historically accumulates leftover vars from the
// pre-rebuild app, including a stale PORT=8080) — explicitly overriding it
// in webServer.env below, rather than trusting the ambient environment,
// means this config can't silently point baseURL/the health check at the
// wrong port depending on whose machine it runs on.
const PORT = Number(process.env.PLAYWRIGHT_WEB_PORT) || 3100;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'test-results/e2e-results.xml' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry'
  },
  webServer: {
    // dotenv mirrors the root `dev` script: `next dev` runs with cwd=apps/web
    // and would otherwise miss the repo-root .env (DATABASE_URL, REDIS_URL,
    // BETTER_AUTH_SECRET, etc.). PORT here always wins over dotenv's own
    // loaded value — dotenv never overrides an already-set process.env var.
    command: 'npx dotenv -- npm run dev --workspace=@ncb/web',
    env: { PORT: String(PORT) },
    // Probe the trivial health route, not `/`. Readiness must not depend on
    // Turbopack compiling the authenticated route tree, which can exceed the
    // timeout on a cold cache.
    url: `${BASE_URL}/api/public/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 180000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: browserChannel }
    }
  ]
});
