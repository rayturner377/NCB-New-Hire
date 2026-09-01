'use strict';

module.exports = {
  id: '001_initial_schema',
  statements: [
    `
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(80) PRIMARY KEY,
        email VARCHAR(254) NOT NULL,
        display_name VARCHAR(140) NOT NULL,
        role ENUM('admin', 'reviewer', 'clinician', 'patient') NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        password_record JSON,
        medical_profile JSON NOT NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at TIMESTAMP(6) NULL,
        UNIQUE KEY uq_app_users_email (email),
        KEY idx_users_role_active (role, active, deleted_at)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS patient_profiles (
        id VARCHAR(80) PRIMARY KEY,
        linked_user_id VARCHAR(80),
        full_name VARCHAR(140) NOT NULL,
        email VARCHAR(254),
        employee_id VARCHAR(80),
        national_id_hash CHAR(64),
        date_of_birth DATE,
        contact_number VARCHAR(50),
        profile_payload LONGBLOB,
        payload_key_version SMALLINT NOT NULL DEFAULT 1,
        created_by VARCHAR(80),
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at TIMESTAMP(6) NULL,
        CONSTRAINT fk_patients_user FOREIGN KEY (linked_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT fk_patients_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
        KEY idx_patients_email (email, deleted_at),
        KEY idx_patients_employee_id (employee_id, deleted_at),
        KEY idx_patients_linked_user (linked_user_id)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS medical_offices (
        id VARCHAR(80) PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        address VARCHAR(500),
        phone VARCHAR(50),
        email VARCHAR(254),
        default_medical_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSON NOT NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at TIMESTAMP(6) NULL,
        CONSTRAINT chk_office_fee CHECK (default_medical_fee >= 0)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS medical_office_members (
        office_id VARCHAR(80) NOT NULL,
        user_id VARCHAR(80) NOT NULL,
        member_type ENUM('doctor', 'clinician') NOT NULL,
        can_submit BOOLEAN NOT NULL DEFAULT FALSE,
        assigned_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (office_id, user_id),
        CONSTRAINT fk_members_office FOREIGN KEY (office_id) REFERENCES medical_offices(id) ON DELETE CASCADE,
        CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
        KEY idx_office_members_user (user_id, office_id)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS medical_cases (
        id VARCHAR(80) PRIMARY KEY,
        patient_id VARCHAR(80) NOT NULL,
        created_by VARCHAR(80),
        assigned_office_id VARCHAR(80),
        assigned_clinician_id VARCHAR(80),
        route ENUM('patient', 'doctor') NOT NULL,
        status ENUM(
          'draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor',
          'doctor_submitted', 'canceled_by_doctor', 'review_pending',
          'reviewed', 'archived', 'withdrawn'
        ) NOT NULL,
        payment_status ENUM('unpaid', 'paid', 'not_payable') NULL,
        payable_amount DECIMAL(12,2) NULL,
        case_payload LONGBLOB,
        payload_key_version SMALLINT NOT NULL DEFAULT 1,
        version INT NOT NULL DEFAULT 1,
        assigned_at TIMESTAMP(6) NULL,
        patient_submitted_at TIMESTAMP(6) NULL,
        doctor_submitted_at TIMESTAMP(6) NULL,
        reviewed_at TIMESTAMP(6) NULL,
        reviewed_by VARCHAR(80),
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at TIMESTAMP(6) NULL,
        CONSTRAINT fk_cases_patient FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_cases_created_by FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT fk_cases_office FOREIGN KEY (assigned_office_id) REFERENCES medical_offices(id) ON DELETE SET NULL,
        CONSTRAINT fk_cases_clinician FOREIGN KEY (assigned_clinician_id) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT fk_cases_reviewer FOREIGN KEY (reviewed_by) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT chk_case_amount CHECK (payable_amount IS NULL OR payable_amount >= 0),
        CONSTRAINT chk_case_version CHECK (version > 0),
        KEY idx_cases_patient_created (patient_id, created_at DESC, deleted_at),
        KEY idx_cases_status_updated (status, updated_at DESC, deleted_at),
        KEY idx_cases_office_status (assigned_office_id, status, updated_at DESC, deleted_at),
        KEY idx_cases_clinician_status (assigned_clinician_id, status, updated_at DESC, deleted_at),
        KEY idx_cases_payment_status (payment_status, updated_at DESC, deleted_at)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS medical_submissions (
        id VARCHAR(80) PRIMARY KEY,
        case_id VARCHAR(80) NOT NULL,
        submitted_by VARCHAR(80),
        submission_version INT NOT NULL DEFAULT 1,
        encrypted_payload LONGBLOB NOT NULL,
        payload_key_version SMALLINT NOT NULL DEFAULT 1,
        payload_sha256 CHAR(64) NOT NULL,
        submitted_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        superseded_at TIMESTAMP(6) NULL,
        CONSTRAINT fk_submissions_case FOREIGN KEY (case_id) REFERENCES medical_cases(id) ON DELETE RESTRICT,
        CONSTRAINT fk_submissions_user FOREIGN KEY (submitted_by) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT chk_submission_version CHECK (submission_version > 0),
        KEY idx_submissions_case_version (case_id, submission_version DESC)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS case_attachments (
        id VARCHAR(80) PRIMARY KEY,
        case_id VARCHAR(80) NOT NULL,
        uploaded_by VARCHAR(80),
        storage_key VARCHAR(500) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        byte_size BIGINT NOT NULL,
        sha256 CHAR(64) NOT NULL,
        scan_status ENUM('pending', 'clean', 'rejected', 'failed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        deleted_at TIMESTAMP(6) NULL,
        CONSTRAINT fk_attachments_case FOREIGN KEY (case_id) REFERENCES medical_cases(id) ON DELETE RESTRICT,
        CONSTRAINT fk_attachments_user FOREIGN KEY (uploaded_by) REFERENCES app_users(id) ON DELETE SET NULL,
        CONSTRAINT chk_attachment_size CHECK (byte_size >= 0),
        KEY idx_attachments_case_created (case_id, created_at DESC, deleted_at)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS audit_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        occurred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        actor_user_id VARCHAR(80),
        event_type VARCHAR(120) NOT NULL,
        entity_type VARCHAR(60),
        entity_id VARCHAR(80),
        request_id VARCHAR(80),
        source_ip_hash CHAR(64),
        details JSON NOT NULL,
        prev_hash CHAR(64),
        event_hash CHAR(64) NOT NULL,
        KEY idx_audit_actor_time (actor_user_id, occurred_at DESC),
        KEY idx_audit_entity_time (entity_type, entity_id, occurred_at DESC),
        KEY idx_audit_type_time (event_type, occurred_at DESC)
      ) ENGINE=InnoDB
    `,
    `
      CREATE TABLE IF NOT EXISTS application_settings (
        setting_key VARCHAR(120) PRIMARY KEY,
        encrypted_value LONGBLOB NOT NULL,
        payload_key_version SMALLINT NOT NULL DEFAULT 1,
        updated_by VARCHAR(80),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `,
    'DROP PROCEDURE IF EXISTS transition_medical_case',
    `
      CREATE PROCEDURE transition_medical_case(
        IN p_case_id VARCHAR(80),
        IN p_expected_version INT,
        IN p_new_status VARCHAR(40),
        IN p_actor_id VARCHAR(80)
      )
      BEGIN
        UPDATE medical_cases
        SET status = p_new_status,
            version = version + 1,
            reviewed_by = IF(p_new_status = 'reviewed', p_actor_id, reviewed_by),
            reviewed_at = IF(p_new_status = 'reviewed', CURRENT_TIMESTAMP(6), reviewed_at),
            payment_status = IF(p_new_status = 'doctor_submitted', 'unpaid', payment_status)
        WHERE id = p_case_id
          AND version = p_expected_version
          AND deleted_at IS NULL;
        IF ROW_COUNT() = 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medical case changed or does not exist';
        END IF;
        SELECT version FROM medical_cases WHERE id = p_case_id;
      END
    `
  ]
};
