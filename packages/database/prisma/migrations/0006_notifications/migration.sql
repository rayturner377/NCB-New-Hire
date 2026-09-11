-- Notification templates (admin-editable subject/body/CC/BCC per notification type) and the
-- Message Centre's email send log — see schema.prisma's NotificationTemplate/EmailMessage.

CREATE TABLE IF NOT EXISTS notification_templates (
  template_key VARCHAR(80) PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  cc_emails VARCHAR(1000),
  bcc_emails VARCHAR(1000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by VARCHAR(80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_messages (
  id VARCHAR(80) PRIMARY KEY,
  template_key VARCHAR(80),
  to_email VARCHAR(500) NOT NULL,
  cc_emails VARCHAR(1000),
  bcc_emails VARCHAR(1000),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  entity_type VARCHAR(60),
  entity_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_status_time ON email_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_to ON email_messages (to_email);
