-- 0019_delegate_role added the 'delegate' role's permissions and its delegate_for_clinician_id
-- column, but missed that app_users.role is also gated by an explicit CHECK constraint (added in
-- 0010_auditor_role, before 'delegate' existed) — inserting a delegate account fails against the
-- live database with a check-constraint violation even though every other part of the role (schema
-- field, permissions, UI) already treats it as valid. This just widens that constraint.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('admin', 'reviewer', 'auditor', 'clinician', 'delegate', 'patient'));
