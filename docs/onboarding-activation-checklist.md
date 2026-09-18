# First account activation

Branch: `feat/first-activation-onboarding`

Success: email → activation code → new password → authenticated landing page.
The browser is remembered using Better Auth's existing device mechanism. Activation
does not send another OTP or a misleading new-device notice. Password reset and
subsequent unfamiliar-browser verification keep their existing behavior.

## Implementation and verification

- [x] Create feature branch; inspect actions, repositories, cookies and notification patterns.
- [x] Atomically bind code redemption to its user and purpose; reject inactive/deleted users,
  stale activation codes and concurrent/replayed claims. Mark email ownership verified.
- [x] Add a server-only activation session endpoint; use normal session hooks and cookie
  attributes, without disabling account-wide device verification or exposing a login token.
- [x] Remember the activating browser using the existing 30-day device contract.
- [x] Redirect directly from successful activation; preserve password-reset behavior.
- [x] Provide a clear sign-in recovery path if password saving succeeds but session setup fails.
- [x] Send an account-activated confirmation through the existing notification service.
- [x] Test rejected claims, activation/reset separation, failures and notifications with mocks.
- [x] Test actual Better Auth session/trust-cookie behavior with synthetic in-memory storage:
  same browser recognized, unfamiliar browser challenged, server-only endpoint inaccessible over HTTP.
- [x] Run relevant unit suites, type checks and uncached lint; inspect final diff.
- [x] Record results and remaining deployment checks below.
- [ ] Before deployment: browser walkthrough against an isolated synthetic database using
  `npm run dev`; verify redirect/cookie persistence and receipt of just the activation confirmation.
- [ ] Before deployment: real PostgreSQL integration tests for concurrent claims and transaction
  rollback in a disposable database. Unit transaction mocks do not prove database concurrency.

## Boundaries

Do not change the running application's database, Docker services or user data.
Tests must use mocks or isolated synthetic storage. Existing unrelated working-tree
changes stay untouched. No deployment is included in this branch.

The existing `emailVerified` flag records proof of email ownership after successful
code redemption; no schema migration is needed. Device cookie compatibility is
covered by tests against the installed Better Auth implementation and must be
rechecked when upgrading that dependency.

## Results

Verified on 2026-09-17:

- Web auth and notification unit tests: 125 passed.
- Access-code repository unit tests: 11 passed.
- Auth package tests: 20 passed, including actual Better Auth in-memory session/cookie compatibility,
  unknown-browser challenge, cookie tampering/expiry/account binding, inaccessible HTTP endpoint,
  and session cleanup on device-record failure.
- Database and auth TypeScript compilation, plus web `tsc --noEmit`: passed.
- Direct ESLint runs (no Turbo or ESLint cache) for auth, database and web: passed.
- No production server/build of the web application, deployment, migration or live-data tests.
  A package build initially hit sandbox process restrictions; the later authorized repository
  unit-test command successfully generated Prisma types. Only a schema comment changed.

The new confirmation uses the existing configurable notification service; delivery still
depends on enabled templates and SMTP. No email code or session token is returned to the client.
The same-request activation action redirects, so its new password is not reposted through the
hidden ordinary-login form. That existing form remains only for password-reset login.

Dependency compatibility: the device record/cookie encoding follows the installed Better Auth
two-factor plugin. Treat the auth compatibility tests as required checks for future upgrades.
The added explicit Zod dependency is pinned to the already installed/tested 4.6.2 version.
