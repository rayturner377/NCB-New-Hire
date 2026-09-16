import { execFileSync } from 'node:child_process';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Real-browser verification of the "single active session per account + mandatory new-device
 * email verification" feature (Better Auth's `two-factor` OTP plugin — see
 * packages/auth/src/index.ts's `twoFactor({...})` registration). Drives an actual sign-in from an
 * unrecognized browser, confirms the verification email actually arrives (via the Message Centre,
 * same pattern as e2e/security-remediation.spec.ts), and exercises the wrong-code, correct-code,
 * concurrent-session-revocation, and trusted-device-skips-the-challenge branches end to end.
 *
 * One browser context stays signed in as admin@ncb.local for the whole file, used ONLY to enable
 * mail once and to read the Message Centre — never as the account under test, since admin signing
 * in repeatedly would keep tripping its own device-verification/session-revocation behavior.
 * doctor@ncb.local is the actual test subject, always in fresh incognito contexts so each one
 * starts with no trust-device cookie. Scenarios build on each other (context A opened in test 3 is
 * inspected in test 4, context B opened in test 4 is reused in test 5), so this runs serial.
 *
 * Every account has twoFactorEnabled: true by default, admin included — so admin's own very first
 * sign-in from this fresh Playwright context also lands on /verify-device, not straight at '/'.
 * That's a real chicken-and-egg for test setup specifically (not a bug): reading the Message Centre
 * to find admin's own code needs an admin session, which is exactly what's blocked. Solved by
 * reading admin's own bootstrap code directly out of Postgres via psql (same direct-DB pattern
 * e2e/security-remediation.spec.ts already uses) for this one-time bootstrap only — every other
 * code lookup in this file (doctor's, and admin's own later device-verified sign-ins never happen
 * again once trusted) goes through the real Message Centre UI as intended.
 */
test.describe.configure({ mode: 'serial' });

/** Talks directly to the same Postgres the dev server is running against — used only for admin's own bootstrap OTP (see the file-level doc comment above for why the Message Centre can't be used for that one case). */
function psql(sql: string): string {
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'ncb_medical_app', '-d', 'ncb_medical', '-tA', '-c', sql], {
    encoding: 'utf8'
  }).trim();
}

/**
 * device-verification-rate-limit.ts's resend budget (3 sends per 10 minutes) is keyed on IP alone,
 * not per-account — so it's shared across every account's first-time device challenge from this
 * machine, admin's own bootstrap login included. That budget is real, intended production behavior
 * this file must not weaken for the scenarios actually under test (doctor's), so instead of leaving
 * it alone and risking the doctor scenarios themselves tripping it, this clears the same Redis key
 * resend-device-code.ts itself would clear on a legitimate resend, purely so admin's own bootstrap
 * housekeeping login (an artifact of this test file's own setup, not part of the feature under
 * test) doesn't eat into the budget the real scenarios need.
 */
function clearDeviceResendRateLimit(): void {
  execFileSync('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', '-a', 'ncb_medical_app', '--no-auth-warning', 'DEL', 'device-resend-rate-limit:::1', 'device-resend-rate-limit:127.0.0.1'], {
    encoding: 'utf8'
  });
}

/**
 * Reads the most recent device_verification_code email body sent to `email` straight from the
 * email_messages table and extracts its 6-digit code — bypasses the Message Centre UI, which
 * requires a session this account doesn't have yet. Strips HTML tags (attributes included) before
 * regex-matching the digits, unlike getLatestCodeForSubject's own `\b(\d{6})\b` match against a
 * rendered iframe's `innerText()` — plain rendered text never contains a stray 6-digit match, but
 * this raw `body_html` column does: the template's own inline `style="color:#666666"` styling
 * matched first and produced "666666" instead of the real code before this fix.
 */
function getCodeViaPsql(email: string, timeoutMs = 30000): string {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const body = psql(
      `SELECT body_html FROM email_messages WHERE to_email = '${email}' AND template_key = 'device_verification_code' ORDER BY created_at DESC LIMIT 1;`
    );
    const textOnly = body.replace(/<[^>]+>/g, ' ');
    const codeMatch = textOnly.match(/\b(\d{6})\b/);
    if (codeMatch) return codeMatch[1]!;
    if (Date.now() > deadline) throw new Error(`No device_verification_code message for ${email} appeared in email_messages within ${timeoutMs}ms`);
  }
}

const PASSWORD = 'DevPassword123!';
const DOCTOR_EMAIL = 'doctor@ncb.local';
const DOCTOR_NAME = 'Demo Doctor';

/** sendNotification fires the actual SMTP send + Message Centre logging detached (see notification-service.ts) — it resolves before that finishes, so the row may not exist yet the instant we navigate to /messages. Reloads until the expected text shows up rather than waiting on a single load. */
async function waitForMessageRow(page: Page, text: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    if (await page.getByText(text).first().isVisible().catch(() => false)) return;
    if (Date.now() > deadline) throw new Error(`Message row containing "${text}" never appeared within ${timeoutMs}ms`);
    await page.waitForTimeout(1000);
  }
}

/**
 * Reads the Message Centre (via the admin page) for the newest message matching both `email` and
 * `templateLabelText`, and extracts the 6-digit code from its rendered body. Filtering on the
 * template-type column (e.g. "New device verification code", the registry's own `label` — see
 * apps/web/features/notifications/registry.ts) rather than the rendered subject matters because a
 * single doctor@ncb.local account under test accumulates both device_verification_code and
 * new_device_signed_in rows across this file's scenarios, and the rendered subject interpolates a
 * configurable {{portalName}} that this test shouldn't need to know.
 */
async function getLatestCodeForSubject(adminPage: Page, email: string, templateLabelText: string | RegExp): Promise<string> {
  await waitForMessageRow(adminPage, email);
  const row = adminPage
    .locator('tr', { has: adminPage.getByText(email) })
    .filter({ has: adminPage.getByText(templateLabelText) })
    .first();
  await expect(row).toBeVisible({ timeout: 30000 });
  // The row's click handler (ClickableTableRow) only exists once React hydrates — the polling
  // `page.goto(..., { waitUntil: 'domcontentloaded' })` in waitForMessageRow fires before hydration
  // is guaranteed complete, so a click landing too early is a silent no-op on a bare <tr> (no native
  // click behavior) and the subsequent waitForURL would hang forever, not just slowly. Confirmed the
  // hard way: real end-to-end testing hit exactly this, intermittently — sometimes hydration had
  // already finished by click time (fast, reliable), sometimes not (hangs indefinitely). Retrying
  // the click every few seconds until the URL actually changes is robust to either case.
  const deadline = Date.now() + 30000;
  for (;;) {
    await row.click();
    try {
      await adminPage.waitForURL(/\/messages\//, { timeout: 5000 });
      break;
    } catch {
      if (Date.now() > deadline) throw new Error(`Clicking the message row for ${email} never navigated to /messages/<id> within 30s`);
    }
  }
  const bodyText = await adminPage.frameLocator('iframe[title="Email content"]').locator('body').innerText();
  const codeMatch = bodyText.match(/\b(\d{6})\b/);
  expect(codeMatch, `expected a 6-digit code in message body:\n${bodyText}`).not.toBeNull();
  return codeMatch![1]!;
}

/** Asserts a message matching `templateLabelText` addressed to `email` eventually shows up in the Message Centre, without needing to extract anything from it. */
async function expectMessageArrives(adminPage: Page, email: string, templateLabelText: string | RegExp, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await adminPage.goto('/messages', { waitUntil: 'domcontentloaded' });
    const row = adminPage
      .locator('tr', { has: adminPage.getByText(email) })
      .filter({ has: adminPage.getByText(templateLabelText) })
      .first();
    if (await row.isVisible().catch(() => false)) return;
    if (Date.now() > deadline) throw new Error(`No message matching "${templateLabelText}" to ${email} appeared within ${timeoutMs}ms`);
    await adminPage.waitForTimeout(1000);
  }
}

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page, displayName: string): Promise<void> {
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('/login');
}

/**
 * Submits a 6-digit code on the CURRENT page, which every call site has already driven to
 * /verify-device (via login()'s own redirect). Deliberately does NOT navigate there itself —
 * /verify-device has no session backing it by design (see its own doc comment: signInEmail's
 * `after` hook already deleted the session signInEmail briefly created), so a fresh, independent
 * `page.goto('/verify-device')` gets bounced straight back to /login by proxy.ts's middleware,
 * which redirects any non-public path to /login when getSession() is null. The page only renders
 * because it arrives via the Server Action's own redirect chain, not a plain navigation to the URL
 * — confirmed the hard way when an earlier version of this helper re-navigated and silently landed
 * back on /login instead of /verify-device, hanging on a #code locator that was never coming.
 */
async function submitDeviceCode(page: Page, code: string): Promise<void> {
  await page.fill('#code', code);
}

let adminContext: BrowserContext;
let adminPage: Page;
// Populated by test 3 and consumed/extended by tests 4 and 5 — scenarios deliberately build on
// each other's live browser contexts (concurrent-session revocation can't be tested any other way).
let contextA: BrowserContext;
let pageA: Page;
let contextB: BrowserContext;
let pageB: Page;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  // Well over the 30s default: a cold Turbopack compile of /login and /verify-device, admin's own
  // device-verification bootstrap (including a docker-exec psql round trip), and enabling mail
  // through the Settings UI all happen here before any real test runs.
  test.setTimeout(90000);
  clearDeviceResendRateLimit();
  adminContext = await browser.newContext();
  adminPage = await adminContext.newPage();
  await login(adminPage, 'admin@ncb.local');
  // admin has twoFactorEnabled: true like every account, so this fresh context's first-ever sign-in
  // is challenged too — resolve it via psql (see getCodeViaPsql's doc comment) rather than the
  // Message Centre, which admin doesn't have a session to read yet.
  await adminPage.waitForURL(/\/(verify-device)?$/, { timeout: 15000 });
  if (adminPage.url().includes('/verify-device')) {
    const adminBootstrapCode = getCodeViaPsql('admin@ncb.local');
    await submitDeviceCode(adminPage, adminBootstrapCode);
  }
  await adminPage.waitForURL('/');
  // Admin's own bootstrap login just spent one of the 3 resend attempts this IP gets per 10 minutes
  // (device-verification-rate-limit.ts is IP-keyed, not per-account) — clear it so the actual
  // doctor-focused scenarios below each get their own fresh send.
  clearDeviceResendRateLimit();

  // Enable mail (even pointed at an unreachable host) so every notification is actually attempted
  // and logged to the Message Centre with its real rendered body.
  await adminPage.goto('/settings', { waitUntil: 'domcontentloaded' });
  await adminPage.getByRole('tab', { name: 'Mail' }).click();
  const mailEnabledCheckbox = adminPage.getByRole('checkbox').first();
  if ((await mailEnabledCheckbox.getAttribute('data-state')) !== 'checked') {
    await mailEnabledCheckbox.click();
  }
  await adminPage.fill('#fromEmail', 'no-reply@example.com');
  await adminPage.fill('#host', '127.0.0.1');
  await adminPage.fill('#port', '1');
  const mailTabPanel = adminPage.locator('[role="tabpanel"][data-state="active"]');
  await mailTabPanel.getByRole('button', { name: /save/i }).click();
  await expect(adminPage.getByText(/saved/i).first()).toBeVisible({ timeout: 10000 });
});

test.afterAll(async () => {
  await adminContext.close();
});

test('1. fresh sign-in from an unrecognized browser is challenged and the code actually arrives', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150000); // cold Turbopack compiles of /verify-device and /messages/[id] on top of the real flow
  clearDeviceResendRateLimit();
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, DOCTOR_EMAIL);
  await page.waitForURL('/verify-device');
  await expect(page.getByRole('heading', { name: /verify it.?s you/i })).toBeVisible();

  const code = await getLatestCodeForSubject(adminPage, DOCTOR_EMAIL, /verification code/i);
  expect(code).toMatch(/^\d{6}$/);

  await context.close();
});

test('2. an incorrect code is rejected and leaves the user on /verify-device', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150000);
  clearDeviceResendRateLimit();
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, DOCTOR_EMAIL);
  await page.waitForURL('/verify-device');

  const realCode = await getLatestCodeForSubject(adminPage, DOCTOR_EMAIL, /verification code/i);
  // Flip the first digit to produce a different, still well-formed 6-digit code.
  const flippedFirstDigit = String((Number(realCode[0]) + 1) % 10);
  const wrongCode = flippedFirstDigit + realCode.slice(1);
  expect(wrongCode).not.toBe(realCode);

  await submitDeviceCode(page, wrongCode);
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/verify-device$/);

  await context.close();
});

test('3. the correct code completes sign-in and emails a new-device notice', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150000);
  clearDeviceResendRateLimit();
  contextA = await browser.newContext();
  pageA = await contextA.newPage();
  await login(pageA, DOCTOR_EMAIL);
  await pageA.waitForURL('/verify-device');

  const code = await getLatestCodeForSubject(adminPage, DOCTOR_EMAIL, /verification code/i);
  await submitDeviceCode(pageA, code);
  await pageA.waitForURL('/', { timeout: 10000 });
  await expect(pageA.getByRole('button', { name: DOCTOR_NAME })).toBeVisible();

  await expectMessageArrives(adminPage, DOCTOR_EMAIL, /new device signed in/i);
});

test('4. a second concurrent sign-in revokes the first session', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150000);
  // Sanity: context A (from test 3) is still signed in before B does anything.
  await pageA.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(pageA.getByRole('button', { name: DOCTOR_NAME })).toBeVisible();

  // A second, fully independent incognito context signs in as the same doctor account — also hits
  // /verify-device since it has no trust-device cookie of its own.
  clearDeviceResendRateLimit();
  contextB = await browser.newContext();
  pageB = await contextB.newPage();
  await login(pageB, DOCTOR_EMAIL);
  await pageB.waitForURL('/verify-device');

  const codeB = await getLatestCodeForSubject(adminPage, DOCTOR_EMAIL, /verification code/i);
  await submitDeviceCode(pageB, codeB);
  await pageB.waitForURL('/', { timeout: 10000 });
  await expect(pageB.getByRole('button', { name: DOCTOR_NAME })).toBeVisible();

  // Completing verification in context B called revokeOtherSessions (verify-device-code.ts), which
  // should have torn down context A's session — reloading it should now bounce to /login.
  await pageA.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(pageA).toHaveURL(/\/login/, { timeout: 10000 });

  await contextA.close();
});

test('5. a later sign-in from the now-trusted browser skips the challenge entirely', async () => {
  await signOut(pageB, DOCTOR_NAME);
  await login(pageB, DOCTOR_EMAIL);
  // The trust-device cookie set when context B completed verification in test 4 should be
  // recognized on this same browser context, so this sign-in should go straight to / with no
  // /verify-device redirect (login.ts's "recognized device" branch).
  await pageB.waitForURL('/', { timeout: 10000 });
  await expect(pageB.getByRole('button', { name: DOCTOR_NAME })).toBeVisible();
});

test('6. a direct call to Better Auth\'s own two-factor/disable endpoint is rejected, not silently honored', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150000);
  // Better Auth's two-factor plugin ships a live POST /api/auth/two-factor/disable endpoint that
  // would otherwise let any authenticated account holder turn off their own twoFactorEnabled with
  // just their password, defeating the "mandatory, no per-account opt-out" design (this app's UI
  // never exposes it, but the raw endpoint is still reachable through the /api/auth/[...all]
  // catch-all). packages/auth/src/index.ts now guards this with a
  // databaseHooks.user.update.before hook that throws FORBIDDEN whenever twoFactorEnabled is set
  // to false through Better Auth's own path. Uses pageB's real, still-live, trusted-device session
  // from test 5 (page.request shares that context's cookies) to prove the guard actually rejects a
  // real request, not just a source-reading claim.
  const response = await pageB.request.post('/api/auth/two-factor/disable', {
    data: { password: PASSWORD }
  });
  expect(response.ok(), `expected /api/auth/two-factor/disable to be rejected, got ${response.status()}: ${await response.text()}`).toBe(false);
  expect(response.status()).toBe(403);

  await contextB.close();

  // Confirm the guard actually held (twoFactorEnabled is still true), not just that this one
  // request errored for an unrelated reason: a brand-new context signing in as the doctor should
  // still be challenged at /verify-device.
  clearDeviceResendRateLimit();
  const verifyContext = await browser.newContext();
  const verifyPage = await verifyContext.newPage();
  await login(verifyPage, DOCTOR_EMAIL);
  await verifyPage.waitForURL('/verify-device', { timeout: 10000 });
  await verifyContext.close();
});
