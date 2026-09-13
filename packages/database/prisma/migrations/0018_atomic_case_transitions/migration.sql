-- transitionCase() (cases-service.ts) previously normalized payment_status to 'not_payable' on a
-- withdraw/cancel via a SEPARATE, non-transactional UPDATE after the version-checked transition
-- itself -- if that second statement failed (a DB hiccup, a connection drop) between the two, a
-- withdrawn/canceled case could be left with a stale payable payment_status. Folding it into the
-- same stored procedure the transition already runs through makes both writes part of one atomic
-- statement, the same way the doctor_submitted -> 'unpaid' reset already was.
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
        WHEN p_new_status = 'doctor_submitted' THEN 'unpaid'
        WHEN p_new_status IN ('withdrawn', 'canceled_by_doctor') THEN 'not_payable'
        ELSE payment_status
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
