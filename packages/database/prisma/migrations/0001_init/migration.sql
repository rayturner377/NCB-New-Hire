-- Mirrors database/migrations/postgres/001-initial-schema.js exactly (same tables,
-- columns, indexes, trigger, and stored procedure), now owned by Prisma Migrate.

CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(80) PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(140) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'reviewer', 'clinician', 'patient')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  password_record JSONB,
  medical_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_app_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  id VARCHAR(80) PRIMARY KEY,
  linked_user_id VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(254),
  employee_id VARCHAR(80),
  national_id_hash CHAR(64),
  date_of_birth DATE,
  contact_number VARCHAR(50),
  profile_payload BYTEA,
  payload_key_version SMALLINT NOT NULL DEFAULT 1,
  created_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS medical_offices (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(500),
  phone VARCHAR(50),
  email VARCHAR(254),
  default_medical_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_medical_fee >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS medical_office_members (
  office_id VARCHAR(80) NOT NULL REFERENCES medical_offices(id) ON DELETE CASCADE,
  user_id VARCHAR(80) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  member_type VARCHAR(20) NOT NULL CHECK (member_type IN ('doctor', 'clinician')),
  can_submit BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (office_id, user_id)
);

CREATE TABLE IF NOT EXISTS medical_cases (
  id VARCHAR(80) PRIMARY KEY,
  patient_id VARCHAR(80) NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
  created_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  assigned_office_id VARCHAR(80) REFERENCES medical_offices(id) ON DELETE SET NULL,
  assigned_clinician_id VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  route VARCHAR(20) NOT NULL CHECK (route IN ('patient', 'doctor')),
  status VARCHAR(40) NOT NULL CHECK (status IN (
    'draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor',
    'doctor_submitted', 'canceled_by_doctor', 'review_pending',
    'reviewed', 'archived', 'withdrawn'
  )),
  payment_status VARCHAR(20) CHECK (payment_status IN ('unpaid', 'paid', 'not_payable')),
  payable_amount NUMERIC(12,2) CHECK (payable_amount IS NULL OR payable_amount >= 0),
  case_payload BYTEA,
  payload_key_version SMALLINT NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_at TIMESTAMPTZ,
  patient_submitted_at TIMESTAMPTZ,
  doctor_submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS medical_submissions (
  id VARCHAR(80) PRIMARY KEY,
  case_id VARCHAR(80) NOT NULL REFERENCES medical_cases(id) ON DELETE RESTRICT,
  submitted_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  submission_version INTEGER NOT NULL DEFAULT 1 CHECK (submission_version > 0),
  encrypted_payload BYTEA NOT NULL,
  payload_key_version SMALLINT NOT NULL DEFAULT 1,
  payload_sha256 CHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS case_attachments (
  id VARCHAR(80) PRIMARY KEY,
  case_id VARCHAR(80) NOT NULL REFERENCES medical_cases(id) ON DELETE RESTRICT,
  uploaded_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  storage_key VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 CHAR(64) NOT NULL,
  scan_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'rejected', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id VARCHAR(80),
  event_type VARCHAR(120) NOT NULL,
  entity_type VARCHAR(60),
  entity_id VARCHAR(80),
  request_id VARCHAR(80),
  source_ip_hash CHAR(64),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash CHAR(64),
  event_hash CHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS application_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  encrypted_value BYTEA NOT NULL,
  payload_key_version SMALLINT NOT NULL DEFAULT 1,
  updated_by VARCHAR(80) REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON app_users (role, active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_email ON patient_profiles (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_employee_id ON patient_profiles (employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_linked_user ON patient_profiles (linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_office_members_user ON medical_office_members (user_id, office_id);
CREATE INDEX IF NOT EXISTS idx_cases_patient_created ON medical_cases (patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_status_updated ON medical_cases (status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_office_status ON medical_cases (assigned_office_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_clinician_status ON medical_cases (assigned_clinician_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_payment_status ON medical_cases (payment_status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_case_version ON medical_submissions (case_id, submission_version DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_case_created ON case_attachments (case_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type_time ON audit_events (event_type, occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON app_users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_patients_updated_at ON patient_profiles;
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patient_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_offices_updated_at ON medical_offices;
CREATE TRIGGER trg_offices_updated_at BEFORE UPDATE ON medical_offices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_cases_updated_at ON medical_cases;
CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON medical_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION transition_medical_case(
  p_case_id VARCHAR,
  p_expected_version INTEGER,
  p_new_status VARCHAR,
  p_actor_id VARCHAR
) RETURNS INTEGER AS $$
DECLARE
  v_new_version INTEGER;
BEGIN
  UPDATE medical_cases
  SET status = p_new_status,
      version = version + 1,
      reviewed_by = CASE WHEN p_new_status = 'reviewed' THEN p_actor_id ELSE reviewed_by END,
      reviewed_at = CASE WHEN p_new_status = 'reviewed' THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
      payment_status = CASE WHEN p_new_status = 'doctor_submitted' THEN 'unpaid' ELSE payment_status END
  WHERE id = p_case_id
    AND version = p_expected_version
    AND deleted_at IS NULL
  RETURNING version INTO v_new_version;
  IF v_new_version IS NULL THEN
    RAISE EXCEPTION 'Medical case changed or does not exist';
  END IF;
  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;
