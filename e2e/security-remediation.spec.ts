import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * Real-browser verification of the fixes made on security/remediation-2026-09 — each test
 * exercises the actual user-facing flow the fix changes, not just the underlying unit-tested
 * logic, against a real (Docker-built, production `next start`) deployment.
 *
 * Requires `npm run db:seed:users` to have been run (see role-access.spec.ts) — reuses the same
 * seeded demo accounts and password.
 */
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'DevPassword123!';

/** The birthdate DateField is a fully-controlled Calendar popover, not a plain fillable input — filling its hidden backing input programmatically never fires the onChange the parent form's validity check depends on (see date-field.tsx's own doc comment), so the date has to actually be picked through the UI. */
async function pickDate(page: Page, triggerId: string, year: number, monthName: string, day: number): Promise<void> {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole('combobox', { name: /year/i }).selectOption(String(year));
  await page.getByRole('combobox', { name: /month/i }).selectOption({ label: monthName });
  await page.getByRole('button', { name: new RegExp(`, ${monthName} ${day}(st|nd|rd|th), ${year}$`) }).click();
}

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

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/** /login redirects straight back to / for an already-authenticated session — every role switch mid-test needs an explicit sign-out first, or the next login() call hangs waiting for a #email field that's never shown. */
async function signOut(page: Page, displayName: string): Promise<void> {
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('/login');
}

test('public self-signup is disabled', async ({ request }: { request: APIRequestContext }) => {
  const response = await request.post('/api/auth/sign-up/email', {
    data: { email: `uninvited-${Date.now()}@example.com`, password: 'SomeRandomPassword123!', name: 'Uninvited User' }
  });
  // disableSignUp makes Better Auth refuse this outright — must not be 200/201 (a created account).
  expect(response.ok()).toBe(false);
});

test('account creation emails an activation code, never a raw password, and it can be redeemed to set one', async ({ page }) => {
  const uniqueEmail = `e2e-candidate-${Date.now()}@example.com`;
  const newPassword = 'BrandNewPassword123!';

  // 1. Enable mail (even pointed at an unreachable host) so the notification is actually attempted
  // and logged to the Message Centre with its real rendered body — this is what lets us inspect
  // what the account-created email actually contains without needing a real inbox.
  await login(page, 'admin@ncb.local');
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Mail' }).click();
  const mailEnabledCheckbox = page.getByRole('checkbox').first();
  if ((await mailEnabledCheckbox.getAttribute('data-state')) !== 'checked') {
    await mailEnabledCheckbox.click();
  }
  await page.fill('#fromEmail', 'no-reply@example.com');
  await page.fill('#host', '127.0.0.1');
  await page.fill('#port', '1');
  const mailTabPanel = page.locator('[role="tabpanel"][data-state="active"]');
  await mailTabPanel.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10000 });

  // 2. Create a new patient account (via the candidate "grant portal access" path).
  await page.goto('/candidates/new', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', 'CandidateA');
  await pickDate(page, 'dateOfBirth', 1990, 'January', 1);
  await page.fill('input[name="position"]', 'Teller');
  await page.fill('input[name="email"]', uniqueEmail);
  await page.getByText('Grant portal access at the email above').click();
  await page.getByRole('button', { name: /create candidate/i }).click();
  await page.waitForURL(/\/candidates\/cand_/);

  // 3. Find the "Account created" message in the Message Centre and read its actual body — this
  // is the direct check that the plaintext-password leak (Message Centre readable by
  // admin/reviewer/auditor) is fixed: the body must carry a 6-digit code, not a password field.
  await waitForMessageRow(page, uniqueEmail);
  await page.getByText(uniqueEmail).first().click();
  await page.waitForURL(/\/messages\//);
  // The rendered email lives in a sandboxed iframe (message-detail.tsx), not the page body directly.
  const bodyText = await page.frameLocator('iframe[title="Email content"]').locator('body').innerText();
  expect(bodyText).not.toMatch(/temporary password/i);
  expect(bodyText).not.toContain(newPassword);
  const codeMatch = bodyText.match(/\b(\d{6})\b/);
  expect(codeMatch, `expected a 6-digit activation code somewhere in the message body:\n${bodyText}`).not.toBeNull();
  const activationCode = codeMatch![1]!;

  await signOut(page, 'Demo Admin');

  // 4. Redeem the code at the public /forgot-password page to set a real password — no admin ever
  // chose or saw this password.
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', uniqueEmail);
  await page.fill('#code', activationCode);
  await page.fill('#password', newPassword);
  await page.fill('#confirmPassword', newPassword);
  await page.getByRole('button', { name: /set new password/i }).click();
  await expect(page.getByText(/password has been set/i)).toBeVisible({ timeout: 10000 });

  // 5. Confirm the new account can actually sign in with the password it just set.
  await login(page, uniqueEmail, newPassword);
  await expect(page.getByRole('button', { name: 'E2E CandidateA' })).toBeVisible();

  // A reused/expired code must not work a second time (single-use).
  await signOut(page, 'E2E CandidateA');
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', uniqueEmail);
  await page.fill('#code', activationCode);
  await page.fill('#password', 'AnotherPassword123!');
  await page.fill('#confirmPassword', 'AnotherPassword123!');
  await page.getByRole('button', { name: /set new password/i }).click();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10000 });
});

test('a patient cannot view or edit another patient\'s candidate profile (IDOR)', async ({ page }) => {
  const emailA = `e2e-idor-a-${Date.now()}@example.com`;
  const emailB = `e2e-idor-b-${Date.now()}@example.com`;
  const passwordA = 'PatientAPassword123!';
  const passwordB = 'PatientBPassword123!';

  async function createPatientCandidate(displayLabel: string, email: string): Promise<string> {
    await page.goto('/candidates/new', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="firstName"]', 'IDOR');
    await page.fill('input[name="lastName"]', displayLabel);
    await pickDate(page, 'dateOfBirth', 1991, 'February', 2);
    await page.fill('input[name="position"]', 'Teller');
    await page.fill('input[name="email"]', email);
    await page.getByText('Grant portal access at the email above').click();
    await page.getByRole('button', { name: /create candidate/i }).click();
    await page.waitForURL(/\/candidates\/(cand_[a-z0-9_]+)/);
    return page.url();
  }

  /** Requires an active (admin/reviewer) session — reads the Message Centre. */
  async function getLatestCode(email: string): Promise<string> {
    await waitForMessageRow(page, email);
    await page.getByText(email).first().click();
    await page.waitForURL(/\/messages\//);
    const bodyText = await page.frameLocator('iframe[title="Email content"]').locator('body').innerText();
    const codeMatch = bodyText.match(/\b(\d{6})\b/);
    return codeMatch![1]!;
  }

  /** /forgot-password redirects away for an already-authenticated session, so this must run signed out. */
  async function redeemCode(email: string, code: string, password: string): Promise<void> {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await page.fill('#email', email);
    await page.fill('#code', code);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.getByRole('button', { name: /set new password/i }).click();
    await expect(page.getByText(/password has been set/i)).toBeVisible({ timeout: 10000 });
  }

  // Set up both candidates + accounts as reviewer first.
  await login(page, 'reviewer@ncb.local');
  const candidateAUrl = await createPatientCandidate('PatientA', emailA);
  const candidateBUrl = await createPatientCandidate('PatientB', emailB);
  await signOut(page, 'Demo Reviewer');

  // Read both activation codes as admin (Message Centre + mail already enabled from the previous test), then sign out before redeeming either.
  await login(page, 'admin@ncb.local');
  const codeA = await getLatestCode(emailA);
  const codeB = await getLatestCode(emailB);
  await signOut(page, 'Demo Admin');

  await redeemCode(emailA, codeA, passwordA);
  await redeemCode(emailB, codeB, passwordB);

  // Patient A tries to reach Patient B's candidate profile directly by URL — requireOwnsCandidate
  // renders a generic "not found" at the same URL (no redirect, so as not to confirm the candidate
  // exists at all), rather than the actual profile data.
  await login(page, emailA, passwordA);
  await page.goto(candidateBUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/candidate not found/i)).toBeVisible();
  await expect(page.getByText('IDOR PatientB')).not.toBeVisible();

  // Patient A can still reach their own, with their real data.
  await page.goto(candidateAUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'IDOR PatientA' })).toBeVisible();
});
