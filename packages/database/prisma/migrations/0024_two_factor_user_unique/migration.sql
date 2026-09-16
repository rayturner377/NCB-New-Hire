-- 0023 created two_factor without a uniqueness guarantee on user_id, but every actual read/write
-- path in Better Auth's own plugin (enableTwoFactor's existingTwoFactor lookup, the OTP
-- verification's account-lockout lookup) treats it as at-most-one-row-per-user — Prisma's own
-- one-to-one relation (AppUser.twoFactor) requires the same. The table is brand new and unused, so
-- this is a plain constraint add, no backfill needed.
DROP INDEX IF EXISTS idx_two_factor_user;

ALTER TABLE two_factor ADD CONSTRAINT two_factor_user_id_key UNIQUE (user_id);
