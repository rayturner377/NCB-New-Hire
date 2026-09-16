-- New 'delegate' role: an assistant acting on behalf of exactly one doctor. See
-- apps/web/lib/permissions.ts's ROLES.DELEGATE and case-authorization.ts's ownsCase() for the
-- read/write side of this; this migration is just the storage.

-- 1:1 link from a delegate account to the one doctor they assist. Nullable/SET NULL so deleting
-- (or role-changing) the doctor account doesn't cascade-delete the delegate account itself.
ALTER TABLE app_users ADD COLUMN delegate_for_clinician_id VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL;
CREATE INDEX idx_users_delegate_for_clinician ON app_users(delegate_for_clinician_id);

-- Lightweight "last edited by" byline for a case's assessment draft — autosave is silent for
-- everyone today (only final submit is audited), so this is not a new audit-log entry per save,
-- just enough for a doctor/reviewer to see at a glance whether a delegate touched the case since
-- it was last opened.
ALTER TABLE medical_cases ADD COLUMN last_edited_by_id VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE medical_cases ADD COLUMN last_edited_at TIMESTAMPTZ(6);

-- Delegate gets the same action set as clinician (doctor), minus medical_cases:billing_view —
-- see permissions.ts's ROLE_PERMISSIONS[ROLES.DELEGATE] doc comment. Also backfills
-- medical_cases:billing_view for every role that could already see a case's payable amount
-- unconditionally before this permission existed (admin gets every permission automatically;
-- reviewer/auditor/clinician need seeding here so introducing the gate doesn't regress them).
INSERT INTO role_permissions (role, permission) VALUES
  ('delegate', 'auth:read'),
  ('delegate', 'session:logout'),
  ('delegate', 'submissions:list'),
  ('delegate', 'submissions:create'),
  ('delegate', 'submissions:view'),
  ('delegate', 'submissions:follow_up'),
  ('delegate', 'medical_cases:list'),
  ('delegate', 'medical_cases:update'),
  ('delegate', 'medical_cases:attach'),
  ('reviewer', 'medical_cases:billing_view'),
  ('auditor', 'medical_cases:billing_view'),
  ('clinician', 'medical_cases:billing_view'),
  ('reviewer', 'delegates:list'),
  ('auditor', 'delegates:list')
ON CONFLICT DO NOTHING;
