-- Postgres-backed sessions, replacing the old in-memory `sessions = new Map()`
-- in server.js (a restart logged everyone out; couldn't run more than one
-- instance). Hand-written (like 0001_init) rather than `prisma migrate dev`
-- auto-diffed, since Prisma's diff engine doesn't understand the partial
-- indexes (`WHERE deleted_at IS NULL`) already in 0001_init and tries to drop
-- and recreate every existing index/FK when asked to diff this schema.

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  csrf_token VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
