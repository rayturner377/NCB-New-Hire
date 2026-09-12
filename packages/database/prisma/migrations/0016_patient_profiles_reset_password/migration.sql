-- New staff-only permission: triggering a candidate's password-reset code. Deliberately not
-- granted to 'patient' (which already holds patient_profiles:update for editing their own
-- record) -- a patient must never be able to reach the HR-facing reset action, even against
-- their own account. See lib/permissions.ts's PATIENT_PROFILES_RESET_PASSWORD.

INSERT INTO role_permissions (role, permission) VALUES
  ('reviewer', 'patient_profiles:reset_password')
ON CONFLICT DO NOTHING;
