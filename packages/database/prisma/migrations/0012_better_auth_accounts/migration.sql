-- Better Auth's credential storage. One row per app_users with provider_id
-- 'credential' holds the password hash — Better Auth stores credentials
-- separately from the user row, unlike the old inline app_users.password_record.
--
-- Better Auth's own session and verification tables are deliberately NOT
-- created here: secondaryStorage (Redis) handles both, so those tables are
-- never written to and don't need to exist (confirmed from Better Auth's own
-- source — @better-auth/core's getAuthTables excludes both from its table
-- set when secondaryStorage is configured without storeInDatabase).

CREATE TABLE accounts (
    id VARCHAR(80) PRIMARY KEY NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    provider_id VARCHAR(60) NOT NULL,
    user_id VARCHAR(80) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ(6),
    refresh_token_expires_at TIMESTAMPTZ(6),
    scope VARCHAR(255),
    password TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
