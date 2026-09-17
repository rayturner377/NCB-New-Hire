-- Mirrors CandidatePayload's own status/position fields as plain columns on patient_profiles — the
-- encrypted profile_payload column stays the source of truth (see candidatesRepository.save(),
-- which writes both on every create/update), but the candidates list previously had to decrypt
-- every candidate in the system just to filter/search by these two fields. Nullable here: existing
-- rows are backfilled by a separate one-time script
-- (packages/database/src/scripts/backfill-candidate-columns.ts), since decrypting profile_payload
-- requires the application's own master key, not something a plain SQL migration can do.
ALTER TABLE patient_profiles ADD COLUMN status VARCHAR(20);
ALTER TABLE patient_profiles ADD COLUMN position VARCHAR(140);

CREATE INDEX idx_patients_status ON patient_profiles(status);
