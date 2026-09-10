-- A real timestamp column for "when was the doctor actually paid", set whenever
-- confirmCasePayment runs (cases-service.ts) from the reviewer-entered `paidOn` date.
-- Previously this only existed buried in an audit event's `details` JSON, which made it
-- unusable for the SLA manager's "time to pay after review" / end-to-end targets without an
-- N+1 audit lookup per case on every case-list render.

ALTER TABLE medical_cases ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
