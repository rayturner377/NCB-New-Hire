-- Makes role -> permission assignment admin-editable (Settings -> Permissions) instead of
-- hardcoded, plus per-user grant/revoke exceptions. Seeds role_permissions with exactly what
-- lib/permissions.ts's ROLE_PERMISSIONS map already granted reviewer/auditor/clinician/patient,
-- so this migration changes storage, not behavior. 'admin' is deliberately never a row here --
-- that role always holds every permission unconditionally in code, so no edit here can lock every
-- admin out of the system.

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permission_overrides JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(30) NOT NULL,
  permission VARCHAR(60) NOT NULL,
  PRIMARY KEY (role, permission)
);

INSERT INTO role_permissions (role, permission) VALUES
  ('reviewer', 'auth:read'),
  ('reviewer', 'session:logout'),
  ('reviewer', 'submissions:list'),
  ('reviewer', 'submissions:view'),
  ('reviewer', 'submissions:review'),
  ('reviewer', 'medical_cases:list'),
  ('reviewer', 'medical_cases:create'),
  ('reviewer', 'medical_cases:update'),
  ('reviewer', 'medical_cases:transition'),
  ('reviewer', 'medical_cases:reassign'),
  ('reviewer', 'medical_cases:hide'),
  ('reviewer', 'medical_cases:attach'),
  ('reviewer', 'medical_cases:payment_confirm'),
  ('reviewer', 'medical_cases:billing_update'),
  ('reviewer', 'medical_cases:patient_update'),
  ('reviewer', 'patient_profiles:list'),
  ('reviewer', 'patient_profiles:create'),
  ('reviewer', 'patient_profiles:update'),
  ('reviewer', 'doctors:list'),
  ('reviewer', 'medical_offices:list'),
  ('reviewer', 'medical_offices:create'),
  ('reviewer', 'reviewers:list'),
  ('reviewer', 'auditors:list'),
  ('reviewer', 'reports:view'),
  ('reviewer', 'notifications:manage'),
  ('reviewer', 'staff_accounts:manage'),
  ('reviewer', 'audit_log:view'),

  ('auditor', 'auth:read'),
  ('auditor', 'session:logout'),
  ('auditor', 'submissions:list'),
  ('auditor', 'submissions:view'),
  ('auditor', 'medical_cases:list'),
  ('auditor', 'patient_profiles:list'),
  ('auditor', 'doctors:list'),
  ('auditor', 'medical_offices:list'),
  ('auditor', 'reviewers:list'),
  ('auditor', 'auditors:list'),
  ('auditor', 'reports:view'),
  ('auditor', 'notifications:view'),
  ('auditor', 'audit_log:view'),

  ('clinician', 'auth:read'),
  ('clinician', 'session:logout'),
  ('clinician', 'submissions:list'),
  ('clinician', 'submissions:create'),
  ('clinician', 'submissions:view'),
  ('clinician', 'submissions:follow_up'),
  ('clinician', 'medical_cases:list'),
  ('clinician', 'medical_cases:update'),
  ('clinician', 'medical_cases:attach'),

  ('patient', 'auth:read'),
  ('patient', 'session:logout'),
  ('patient', 'medical_cases:list'),
  ('patient', 'medical_cases:patient_update'),
  ('patient', 'patient_profiles:list'),
  ('patient', 'patient_profiles:update'),
  ('patient', 'doctors:list')
ON CONFLICT DO NOTHING;
