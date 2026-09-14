import { execFileSync } from 'node:child_process';
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

/** Requires an active (admin/reviewer) session that can create candidates — see PATIENT_PROFILES_CREATE. */
async function createPatientCandidate(page: Page, lastName: string, email: string): Promise<string> {
  await page.goto('/candidates/new', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', lastName);
  await pickDate(page, 'dateOfBirth', 1991, 'February', 2);
  await page.fill('input[name="position"]', 'Teller');
  await page.fill('input[name="email"]', email);
  await page.getByText('Grant portal access at the email above').click();
  await page.getByRole('button', { name: /create candidate/i }).click();
  await page.waitForURL(/\/candidates\/(cand_[a-z0-9_]+)/);
  return page.url();
}

/** Requires an active (admin/reviewer) session — reads the Message Centre. */
async function getLatestCode(page: Page, email: string): Promise<string> {
  await waitForMessageRow(page, email);
  await page.getByText(email).first().click();
  await page.waitForURL(/\/messages\//);
  const bodyText = await page.frameLocator('iframe[title="Email content"]').locator('body').innerText();
  const codeMatch = bodyText.match(/\b(\d{6})\b/);
  return codeMatch![1]!;
}

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}

/**
 * Fills email and clicks Next, then lands wherever checkSignInMethodAction routes to: straight to
 * code entry when the email already has a live code (a fresh activation, or an unredeemed reset),
 * or to the ordinary password step — in which case "Forgot password?" needs an explicit click to
 * reach the same code step. Leaves the page on the code step either way. Must run signed out: an
 * authenticated session is redirected away from /login before any of this renders.
 */
async function proceedToCodeStep(page: Page, email: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.getByRole('button', { name: 'Next' }).click();

  const codeInput = page.locator('#code');
  const forgotPasswordButton = page.getByRole('button', { name: /forgot password/i });
  await expect(codeInput.or(forgotPasswordButton)).toBeVisible({ timeout: 10000 });
  if (await forgotPasswordButton.isVisible().catch(() => false)) {
    await forgotPasswordButton.click();
    await expect(codeInput).toBeVisible({ timeout: 10000 });
  }
}

/** Drives the unified /login page's code branch end to end: {@link proceedToCodeStep}, then the code (the new-password fields unfold automatically once 6 digits verify, see login-form.tsx) → new password → auto sign-in → redirect to /. */
async function redeemCode(page: Page, email: string, code: string, password: string): Promise<void> {
  await proceedToCodeStep(page, email);
  await page.fill('#code', code);
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.getByRole('button', { name: /set new password/i }).click();
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Same as redeemCode up through entering the code, for asserting on a code that should be
 * rejected (reused/expired/wrong) — stops right after entering it instead of going on to the
 * new-password step, which never appears.
 */
async function attemptRedeemWithBadCode(page: Page, email: string, code: string): Promise<void> {
  await proceedToCodeStep(page, email);
  await page.fill('#code', code);
}

/** /login redirects straight back to / for an already-authenticated session — every role switch mid-test needs an explicit sign-out first, or the next login() call hangs waiting for a #email field that's never shown. */
async function signOut(page: Page, displayName: string): Promise<void> {
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('/login');
}

/** Talks directly to the same Postgres the Docker-built app is running against, for assertions no UI surfaces (row-level DB state) — see its use in the atomicity test below. */
function psql(sql: string): string {
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'ncb_medical_app', '-d', 'ncb_medical', '-tA', '-c', sql], {
    encoding: 'utf8'
  }).trim();
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

  // 4. Redeem the code on the unified /login page — entering this email routes straight to code
  // entry since the account has a live activation code, no "Forgot password?" click needed — to
  // set a real password (no admin ever chose or saw it) and confirm it seamlessly signs the
  // account in rather than dumping them back at a sign-in form they'd have to fill out again.
  await redeemCode(page, uniqueEmail, activationCode, newPassword);
  await expect(page.getByRole('button', { name: 'E2E CandidateA' })).toBeVisible();

  // The now-consumed code must not work a second time. With no live code left, /login's email
  // step routes to the ordinary password field instead of code entry — attemptRedeemWithBadCode
  // clicks through "Forgot password?" to reach a code field again, so this proves the *old* code
  // specifically is dead (a fresh request would issue a different one, and this one still fails).
  await signOut(page, 'E2E CandidateA');
  await attemptRedeemWithBadCode(page, uniqueEmail, activationCode);
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10000 });
});

test('a patient cannot view or edit another patient\'s candidate profile (IDOR)', async ({ page }) => {
  const emailA = `e2e-idor-a-${Date.now()}@example.com`;
  const emailB = `e2e-idor-b-${Date.now()}@example.com`;
  const passwordA = 'PatientAPassword123!';
  const passwordB = 'PatientBPassword123!';

  // Set up both candidates + accounts as reviewer first.
  await login(page, 'reviewer@ncb.local');
  const candidateAUrl = await createPatientCandidate(page, 'PatientA', emailA);
  const candidateBUrl = await createPatientCandidate(page, 'PatientB', emailB);
  await signOut(page, 'Demo Reviewer');

  // Read both activation codes as admin (Message Centre + mail already enabled from the previous test), then sign out before redeeming either.
  await login(page, 'admin@ncb.local');
  const codeA = await getLatestCode(page, emailA);
  const codeB = await getLatestCode(page, emailB);
  await signOut(page, 'Demo Admin');

  // redeemCode now seamlessly signs the account in as its very last step (see login-form.tsx) — an
  // explicit sign-out is needed between the two before /login is reachable again for the next one.
  await redeemCode(page, emailA, codeA, passwordA);
  await signOut(page, 'E2E PatientA');
  await redeemCode(page, emailB, codeB, passwordB);
  await signOut(page, 'E2E PatientB');

  // Patient A tries to reach Patient B's candidate profile directly by URL — requireOwnsCandidate
  // renders a generic "not found" at the same URL (no redirect, so as not to confirm the candidate
  // exists at all), rather than the actual profile data.
  await login(page, emailA, passwordA);
  await page.goto(candidateBUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/candidate not found/i)).toBeVisible();
  await expect(page.getByText('E2E PatientB')).not.toBeVisible();

  // Patient A can still reach their own, with their real data.
  await page.goto(candidateAUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'E2E PatientA' })).toBeVisible();
});

test('mutations closed in the audit-coverage pass are actually recorded in /audit', async ({ page }) => {
  // Six full login/logout cycles plus a resend that awaits a real (unreachable) SMTP round trip —
  // comfortably over the default 30s test budget even though no single step is slow on its own.
  test.setTimeout(120000);
  const email = `e2e-audit-${Date.now()}@example.com`;
  const password = 'AuditPassword123!';

  // 1. candidate_created — reviewer creates the candidate/account.
  await login(page, 'reviewer@ncb.local');
  const candidateUrl = await createPatientCandidate(page, 'AuditSubject', email);

  // 2. candidate_updated (staff-edit path, update-candidate.ts) — the candidate detail page's
  // profile section is directly editable in place for anyone with PATIENT_PROFILES_UPDATE, no
  // separate edit route.
  await page.goto(candidateUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="city"]', 'Kingston');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText(/candidate profile updated/i)).toBeVisible({ timeout: 10000 });
  await signOut(page, 'Demo Reviewer');

  // 3. account_activated (via the unified /login page's code-redemption branch) then
  // candidate_updated a second time (self-edit path, update-own-profile.ts — previously had NO
  // actorId/audit at all).
  await login(page, 'admin@ncb.local');
  const code = await getLatestCode(page, email);
  await signOut(page, 'Demo Admin');
  // redeemCode already signs the account in as its last step — no separate login() call needed.
  await redeemCode(page, email, code, password);
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="city"]', 'Montego Bay');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText(/profile updated/i)).toBeVisible({ timeout: 10000 });

  // 4. sessions_revoked — the same self-service action used to react to a suspicious login.
  await page.getByRole('button', { name: /sign out of other devices/i }).click();
  await expect(page.getByText(/every other device has been signed out/i)).toBeVisible({ timeout: 10000 });
  await signOut(page, 'E2E AuditSubject');

  // 5. medical_office_created — admin creates a new facility.
  await login(page, 'admin@ncb.local');
  const officeName = `E2E Audit Clinic ${Date.now()}`;
  await page.goto('/medical-offices/new', { waitUntil: 'domcontentloaded' });
  await page.fill('#name', officeName);
  await page.getByRole('button', { name: /create facility/i }).click();
  await page.waitForURL(/\/doctors\?tab=offices/);

  // 6. message_resent — resend the activation email we just read above.
  await getLatestCode(page, email); // navigates into the message detail page for `email`'s latest message
  const resendButton = page.getByRole('button', { name: /^resend$/i });
  const resendForm = page.locator('form', { has: resendButton });
  await resendButton.click();
  // resendMessageAction awaits the real SMTP round trip (unlike the fire-and-forget dispatch every
  // other notification path uses), so this can take a moment. The audit event is written up front,
  // before the send is attempted (see resendEmailMessage), so it's recorded regardless of the
  // outcome here — the mail host is deliberately unreachable in this test, so delivery itself is
  // expected to fail; we only need the action to have actually run.
  await expect(resendButton).toBeEnabled({ timeout: 30000 });
  await expect(resendForm.getByRole('alert')).toBeVisible();

  // Now verify every one of the above actually landed in the audit trail, most-recent-first.
  await page.goto(
    '/audit?type=candidate_created,candidate_updated,sessions_revoked,medical_office_created,message_resent',
    { waitUntil: 'domcontentloaded' }
  );
  const auditTable = page.locator('table');
  await expect(auditTable.getByText('Candidate created').first()).toBeVisible();
  // At least 2 (staff edit + self edit) — not an exact count, since re-running this suite against
  // a persistent database (rather than a reset-per-run fixture) leaves earlier runs' rows in place.
  expect(await auditTable.getByText('Candidate profile updated').count()).toBeGreaterThanOrEqual(2);
  await expect(auditTable.getByText('Other sessions signed out').first()).toBeVisible();
  await expect(auditTable.getByText('Medical office created').first()).toBeVisible();
  await expect(auditTable.getByText('Message resent').first()).toBeVisible();
});

test('case transitions are atomic and version-guarded (transition_medical_case)', async () => {
  // The patient intake → doctor submission flow that exercises this stored procedure end-to-end
  // requires the full multi-page medical/family history forms and a signature pad — driving that
  // through the browser would make this test almost entirely about form-filling, not about the
  // concurrency guarantee itself. The guarantee lives entirely in the SQL added in migration
  // 0018_atomic_case_transitions (see packages/database/src/repositories/cases.ts's
  // submitAndTransition/confirmPayment, which both delegate the actual state change to it), so it's
  // verified directly against the same Postgres the Docker-built app is running against.
  const caseId = `case_e2e_atomic_${Date.now()}`;
  const patientId = `cand_e2e_atomic_${Date.now()}`;
  const userId = `usr_e2e_atomic_${Date.now()}`;

  try {
    psql(
      `INSERT INTO app_users (id, email, display_name, role) VALUES ('${userId}', '${userId}@example.com', 'E2E Atomic Test', 'reviewer')`
    );
    psql(`INSERT INTO patient_profiles (id, full_name, created_by) VALUES ('${patientId}', 'E2E Atomic Patient', '${userId}')`);
    psql(
      `INSERT INTO medical_cases (id, patient_id, route, status, payment_status, version) VALUES ('${caseId}', '${patientId}', 'doctor', 'doctor_submitted', 'unpaid', 1)`
    );

    // A stale version must be rejected outright, leaving status/payment_status/version untouched —
    // this is the optimistic-concurrency guard a race between two transitions relies on.
    expect(() => psql(`SELECT transition_medical_case('${caseId}', 0, 'withdrawn', '${userId}')`)).toThrow();
    const afterRejectedAttempt = psql(`SELECT status, payment_status, version FROM medical_cases WHERE id = '${caseId}'`);
    expect(afterRejectedAttempt).toBe('doctor_submitted|unpaid|1');

    // The correct version succeeds and normalizes payment_status to not_payable in the same
    // statement as the status change — the atomicity this migration exists to guarantee (no window
    // where a case could be read as withdrawn but still unpaid, or vice versa).
    const newVersion = psql(`SELECT transition_medical_case('${caseId}', 1, 'withdrawn', '${userId}')`);
    expect(newVersion).toBe('2');
    const afterSuccess = psql(`SELECT status, payment_status, version FROM medical_cases WHERE id = '${caseId}'`);
    expect(afterSuccess).toBe('withdrawn|not_payable|2');

    // Now that the version has moved to 2, the original expected-version-1 caller (e.g. a second
    // browser tab that loaded the case before either transition) must also be rejected.
    expect(() => psql(`SELECT transition_medical_case('${caseId}', 1, 'reviewed', '${userId}')`)).toThrow();
  } finally {
    psql(`DELETE FROM medical_cases WHERE id = '${caseId}'`);
    psql(`DELETE FROM patient_profiles WHERE id = '${patientId}'`);
    psql(`DELETE FROM app_users WHERE id = '${userId}'`);
  }
});

test('an already-activated account can self-serve a new password via "Forgot password?" with no admin involved', async ({ page }) => {
  const email = `e2e-self-reset-${Date.now()}@example.com`;
  const firstPassword = 'FirstPassword123!';
  const secondPassword = 'SecondPassword456!';

  // Set up and activate an account the ordinary way first — this test is specifically about the
  // *second* code, the one nobody (no HR, no admin) had any part in requesting.
  await login(page, 'reviewer@ncb.local');
  await createPatientCandidate(page, 'SelfReset', email);
  await signOut(page, 'Demo Reviewer');
  await login(page, 'admin@ncb.local');
  const activationCode = await getLatestCode(page, email);
  await signOut(page, 'Demo Admin');
  await redeemCode(page, email, activationCode, firstPassword);
  await expect(page.getByRole('button', { name: 'E2E SelfReset' })).toBeVisible();
  await signOut(page, 'E2E SelfReset');

  // Now, entirely self-service: click "Forgot password?" for an account that already has a real
  // password, with no session and no admin/HR action anywhere in this flow.
  await redeemCode(page, email, await getSelfRequestedCode(page, email), secondPassword);
  await expect(page.getByRole('button', { name: 'E2E SelfReset' })).toBeVisible();
  await signOut(page, 'E2E SelfReset');

  // The old password must no longer work; the new one must.
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.fill('#password', firstPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });

  await login(page, email, secondPassword);
  await expect(page.getByRole('button', { name: 'E2E SelfReset' })).toBeVisible();

  /**
   * Triggers "Forgot password?" for `targetEmail` and reads the resulting code from the Message
   * Centre — needs an admin/reviewer session to read the Message Centre with, but the trigger
   * itself (the part actually under test) runs fully signed out.
   */
  async function getSelfRequestedCode(p: Page, targetEmail: string): Promise<string> {
    await p.goto('/login', { waitUntil: 'networkidle' });
    await p.fill('#email', targetEmail);
    await p.getByRole('button', { name: 'Next' }).click();
    await p.getByRole('button', { name: /forgot password/i }).click();
    // Confirms the code step actually rendered (as opposed to the request silently no-opping)
    // before switching sessions to go read it.
    await expect(p.getByLabel('6-digit code')).toBeVisible({ timeout: 10000 });
    await login(p, 'admin@ncb.local');
    const requestedCode = await getLatestCode(p, targetEmail);
    await signOut(p, 'Demo Admin');
    return requestedCode;
  }
});

test('HR can choose how long a new candidate\'s activation code stays valid', async ({ page }) => {
  const email = `e2e-custom-ttl-${Date.now()}@example.com`;

  await login(page, 'reviewer@ncb.local');
  await page.goto('/candidates/new', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', 'CustomTtl');
  await pickDate(page, 'dateOfBirth', 1992, 'March', 3);
  await page.fill('input[name="position"]', 'Teller');
  await page.fill('input[name="email"]', email);
  await page.getByText('Grant portal access at the email above').click();

  // The TTL picker only appears once portal access is checked, defaults to 24 hours, and offers
  // exactly the presets HR was promised (15m/1h/24h/48h) — pick the shortest one.
  const ttlTrigger = page.getByRole('combobox', { name: /activation code expires in/i });
  await expect(ttlTrigger).toBeVisible();
  await expect(ttlTrigger).toHaveText(/24 hours/i);
  await ttlTrigger.click();
  await page.getByRole('option', { name: '15 minutes' }).click();

  await page.getByRole('button', { name: /create candidate/i }).click();
  await page.waitForURL(/\/candidates\/cand_/);

  const row = psql(
    `SELECT EXTRACT(EPOCH FROM (ac.expires_at - ac.created_at)) FROM access_codes ac JOIN app_users u ON u.id = ac.user_id WHERE u.email = '${email}' ORDER BY ac.created_at DESC LIMIT 1`
  );
  const ttlSeconds = Number(row);
  // Allow a little slack either side of exactly 15 minutes for the round trip through the request.
  expect(ttlSeconds).toBeGreaterThan(14 * 60);
  expect(ttlSeconds).toBeLessThan(16 * 60);
});
