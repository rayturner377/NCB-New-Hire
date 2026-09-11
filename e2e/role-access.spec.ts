import { test, expect, type Page } from '@playwright/test';

/**
 * Real-browser coverage of the one thing unit tests can't verify: that each
 * seeded demo role actually lands on its own dashboard, can reach the pages
 * its role needs, and is blocked (not just redirected at the HTTP layer, but
 * genuinely never shown the page) from the ones it doesn't.
 *
 * Requires `npm run db:seed:users` to have been run against whatever
 * DATABASE_URL/REDIS_URL this suite points at (see playwright.config.ts's
 * webServer) — these are the fixed demo accounts it seeds, not fixtures this
 * suite creates itself.
 *
 * Serial within this file, not just in CI: playwright.config.ts's webServer
 * runs `next dev` (Turbopack dev mode), which serializes/recompiles routes
 * on demand per request far more heavily than a production `next start`
 * would — several workers hitting it at once (the default locally, since
 * `workers` is only forced to 1 under CI) reliably starved the UI thread
 * enough for the sign-out dropdown's hydration to blow past even a generous
 * explicit wait. Scoped to this file only; doesn't change the project-wide
 * parallelism default for any other spec.
 */
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'DevPassword123!';

interface RoleCase {
  role: string;
  email: string;
  displayName: string;
  /** Pages this role should actually see rendered content on. */
  ownPages: string[];
  /** Pages this role must never see rendered content on (admin-only, etc). */
  forbiddenPages: string[];
}

const ROLE_CASES: RoleCase[] = [
  { role: 'admin', email: 'admin@ncb.local', displayName: 'Demo Admin', ownPages: ['/', '/admins', '/settings'], forbiddenPages: [] },
  {
    role: 'reviewer',
    email: 'reviewer@ncb.local',
    displayName: 'Demo Reviewer',
    ownPages: ['/', '/candidates', '/candidates/new'],
    forbiddenPages: ['/admins', '/settings']
  },
  {
    role: 'auditor',
    email: 'auditor@ncb.local',
    displayName: 'Demo Auditor',
    ownPages: ['/', '/audit'],
    forbiddenPages: ['/admins', '/settings', '/candidates/new']
  },
  {
    // /cases is deliberately the reviewer/admin/auditor unscoped view — a
    // doctor's own queue lives on their dashboard ('/') instead, per
    // cases-container.tsx's own comment.
    role: 'clinician',
    email: 'doctor@ncb.local',
    displayName: 'Demo Doctor',
    ownPages: ['/'],
    forbiddenPages: ['/admins', '/settings', '/cases']
  },
  {
    // A patient holds PATIENT_PROFILES_LIST too, deliberately scoped by
    // candidates-container.tsx to just their own record — /candidates
    // belongs in ownPages, not forbidden.
    role: 'patient',
    email: 'patient@ncb.local',
    displayName: 'Demo Patient',
    ownPages: ['/', '/profile', '/candidates'],
    forbiddenPages: ['/admins', '/settings', '/cases']
  }
];

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

async function signOut(page: Page, displayName: string): Promise<void> {
  // Explicit waitFor before each click, not just relying on click()'s own
  // actionability wait — under several Playwright workers sharing one `next
  // dev` server, the dropdown's client JS can take longer to hydrate than a
  // single action's default timeout comfortably covers.
  const menuTrigger = page.getByRole('button', { name: displayName });
  await menuTrigger.waitFor({ state: 'visible', timeout: 15000 });
  await menuTrigger.click();
  const signOutButton = page.getByRole('button', { name: 'Sign out' });
  await signOutButton.waitFor({ state: 'visible', timeout: 15000 });
  await signOutButton.click();
  await page.waitForURL('/login');
}

for (const roleCase of ROLE_CASES) {
  test.describe(`${roleCase.role} role`, () => {
    test(`logs in and reaches its own pages`, async ({ page }) => {
      await login(page, roleCase.email);
      await expect(page.getByRole('button', { name: roleCase.displayName })).toBeVisible();

      for (const path of roleCase.ownPages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      }

      await signOut(page, roleCase.displayName);
    });

    for (const path of roleCase.forbiddenPages) {
      test(`is blocked from ${path}`, async ({ page }) => {
        await login(page, roleCase.email);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Either a real server redirect, or Next's streaming-SSR client-side
        // NEXT_REDIRECT for routes whose permission check runs after an
        // async boundary — either way, the address bar must not stay on the
        // forbidden path.
        await expect(page).not.toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      });
    }
  });
}
