-- Drops the legacy PBKDF2 password_record column now that every AppUser has
-- a Better Auth credential Account row (see the now-removed one-time
-- migrate-users-to-better-auth backfill script) and @ncb/auth's verify() no
-- longer has a legacy-format fallback to read it for.
ALTER TABLE "app_users" DROP COLUMN "password_record";
