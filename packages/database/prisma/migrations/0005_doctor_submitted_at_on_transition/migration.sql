-- Backfill doctor_submitted_at for cases that already passed through
-- doctor_submitted before this column was ever actually populated (see the
-- CREATE OR REPLACE FUNCTION below — transition_medical_case declared this
-- column since 0001_init but never set it). Every downstream reader (the
-- org-wide billing report's financial-year filter, a doctor's own "processed
-- this month" count, the reviewer dashboard's queue-age display) silently
-- treated every case as if it had never been submitted.
UPDATE medical_cases mc
SET doctor_submitted_at = sub.occurred_at
FROM (
  SELECT DISTINCT ON (entity_id) entity_id, occurred_at
  FROM audit_events
  WHERE entity_type = 'case'
    AND event_type = 'case_transition'
    AND details->>'to' = 'doctor_submitted'
  ORDER BY entity_id, occurred_at DESC
) sub
WHERE mc.id = sub.entity_id
  AND mc.doctor_submitted_at IS NULL;

-- Sets doctor_submitted_at every time a case (re)enters doctor_submitted —
-- the same way payment_status already resets to 'unpaid' on that same
-- transition, right below it: a case bounced back and resubmitted should
-- show its most recent submission date, not silently stay null forever.
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
      payment_status = CASE WHEN p_new_status = 'doctor_submitted' THEN 'unpaid' ELSE payment_status END,
      doctor_submitted_at = CASE WHEN p_new_status = 'doctor_submitted' THEN CURRENT_TIMESTAMP ELSE doctor_submitted_at END
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
