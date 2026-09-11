-- Drops the pre-Better-Auth Postgres sessions table. Session storage moved
-- to Redis (via Better Auth's secondaryStorage) in the Better Auth cutover;
-- this table has had no reader or writer since, confirmed by no remaining
-- references to sessionsRepository anywhere outside packages/database
-- itself (now also removed).
DROP TABLE "sessions";
