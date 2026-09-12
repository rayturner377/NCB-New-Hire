-- Replaces emailing a real chosen password (which ended up persisted in plaintext in
-- email_messages.bodyHtml, readable by anyone with Message Centre access) with an expiring,
-- single-use 6-digit code. Only a hash of the code is ever stored -- see lib/access-codes.ts.

CREATE TABLE IF NOT EXISTS access_codes (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('account_activation', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_codes_user_purpose ON access_codes (user_id, purpose, created_at DESC);
