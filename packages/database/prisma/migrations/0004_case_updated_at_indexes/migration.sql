-- listForPatient/listForClinician (packages/database/src/repositories/cases.ts) filter by
-- patientId/assignedClinicianId and sort by updated_at, but the only existing indexes on those
-- columns sort by created_at or lead with status — neither matches this sort, so Postgres has to
-- re-sort after the index scan. These match the real query shape.
CREATE INDEX "idx_cases_patient_updated" ON "medical_cases" ("patient_id", "updated_at" DESC);
CREATE INDEX "idx_cases_clinician_updated" ON "medical_cases" ("assigned_clinician_id", "updated_at" DESC);
