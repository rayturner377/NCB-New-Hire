-- Required by Better Auth's `two-factor` plugin's own schema (see node_modules/better-auth's
-- plugins/two-factor/schema.mjs) — this app only ever enables the OTP method, never TOTP, so no row
-- is ever actually created here, but the table itself still has to exist: the plugin's own
-- signInEmail `after` hook and its verifyTwoFactorOTP handler both unconditionally query this table
-- on every 2FA-gated sign-in (to check for a stored TOTP secret, and for account-lockout state,
-- respectively), and throw a schema-mismatch error if it's simply missing — confirmed the hard way
-- (real end-to-end testing broke every sign-in with this table absent), not merely from Better
-- Auth's own docs.
CREATE TABLE two_factor (
  id VARCHAR(64) PRIMARY KEY,
  secret TEXT NOT NULL,
  backup_codes TEXT NOT NULL,
  user_id VARCHAR(80) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT true,
  failed_verification_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE INDEX idx_two_factor_user ON two_factor(user_id);
