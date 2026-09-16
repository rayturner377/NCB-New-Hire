-- Better Auth's `two-factor` plugin (OTP method) expects AppUser.twoFactorEnabled to exist.
-- DEFAULT true enables the emailed new-device verification challenge for every account, existing
-- and new, with no per-account opt-in step — see packages/auth/src/index.ts's twoFactor()
-- registration and login.ts's handling of signInEmail's twoFactorRedirect response.
ALTER TABLE app_users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT true;
