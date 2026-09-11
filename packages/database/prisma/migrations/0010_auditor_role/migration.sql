-- The 'auditor' role has been fully implemented in the application layer (lib/permissions.ts's
-- ROLES.AUDITOR, ROLE_PERMISSIONS, nav-config.ts) since this rebuild's early SLA/role work, but
-- this table's own CHECK constraint (0001_init) never included it -- app_users.role only ever
-- allowed 'admin', 'reviewer', 'clinician', 'patient'. No user with role='auditor' could ever
-- actually be created; the database itself silently made the whole role unusable.

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('admin', 'reviewer', 'auditor', 'clinician', 'patient'));
