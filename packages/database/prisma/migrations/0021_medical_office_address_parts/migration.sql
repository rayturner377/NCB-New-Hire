-- Splits medical_offices' single free-text `address` column into the same
-- 5-part shape (line1/line2/city/state/country) the candidate profile and
-- patient case form already store their own address in — needed so the
-- facility form can use the shared, structured AddressFields component
-- (apps/web/components/form/address-fields.tsx) instead of one bare text
-- input, and so an edit can round-trip the parts cleanly instead of
-- re-parsing a single freeform string. The old value is a reasonable
-- best-effort backfill into address_line1 (better than losing it outright);
-- an admin can re-split it into the other parts by hand if they want it
-- tidier.
ALTER TABLE medical_offices ADD COLUMN address_line1 VARCHAR(120);
ALTER TABLE medical_offices ADD COLUMN address_line2 VARCHAR(120);
ALTER TABLE medical_offices ADD COLUMN city VARCHAR(80);
ALTER TABLE medical_offices ADD COLUMN state VARCHAR(80);
ALTER TABLE medical_offices ADD COLUMN country VARCHAR(80);

UPDATE medical_offices SET address_line1 = address WHERE address IS NOT NULL;

ALTER TABLE medical_offices DROP COLUMN address;
