-- Better Auth's core user schema (unconditional, not from any plugin)
-- requires email_verified and image on whatever table its `user` model maps
-- to (app_users here) — the Prisma adapter selects every field it declares
-- for a model, so these have to exist even though this app has no
-- email-verification flow and never sets a user image.

ALTER TABLE app_users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN image TEXT;
