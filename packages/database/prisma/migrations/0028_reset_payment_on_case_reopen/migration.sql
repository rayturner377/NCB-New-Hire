-- A reviewed-and-paid case reopened (sent back to the doctor or patient for rework) previously kept
-- its stale payment_status='paid'/payment_confirmed_at while sitting in an earlier, not-yet-reviewed
-- stage -- the billing tab would still show it as paid even though the assessment it was paid for is
-- being redone. Reset both, the same way payment_status already resets to 'unpaid' on reaching
-- doctor_submitted and to 'not_payable' on withdraw/cancel (see 0018_atomic_case_transitions) -- a
-- no-op for a case that wasn't paid yet (already 'unpaid'/NULL), a real reset for one that was.
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
      payment_status = CASE
        WHEN p_new_status IN ('doctor_submitted', 'sent_to_doctor', 'sent_to_patient') THEN 'unpaid'
        WHEN p_new_status IN ('withdrawn', 'canceled_by_doctor') THEN 'not_payable'
        ELSE payment_status
      END,
      payment_confirmed_at = CASE
        WHEN p_new_status IN ('sent_to_doctor', 'sent_to_patient') THEN NULL
        ELSE payment_confirmed_at
      END,
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
