/**
 * Ported from server.js sanitizeMedicalProfile (~L5049-5061) — the doctor-
 * specific fields the old app's doctorSetupForm collected beyond name/email/
 * password (facility, registration number, rate), which the newer unified
 * user-management modal had actually dropped from its own create flow. Only
 * relevant when the account being created/edited is a doctor.
 */
export function combineMedicalProfile(formData: FormData): Record<string, unknown> {
  const officeUserType = String(formData.get('officeUserType') || 'doctor').trim() || 'doctor';
  // facilityId is the real reference (features/medical-offices); facilityName/facilityAddress are
  // a snapshot of that office's current name/address at save time, kept alongside it so existing
  // readers (e.g. the patient case form's doctor picker) don't need an extra lookup — see
  // components/form/doctor-profile-fields.tsx's hidden inputs, which set these from the selection.
  const facilityId = String(formData.get('facilityId') || '').trim();
  const facilityName = String(formData.get('facilityName') || '').trim();
  const facilityAddress = String(formData.get('facilityAddress') || '').trim();
  const registrationNumber = String(formData.get('registrationNumber') || '').trim();
  const feeRaw = Number.parseFloat(String(formData.get('defaultMedicalFee') || ''));
  const defaultMedicalFee = officeUserType === 'doctor' && Number.isFinite(feeRaw) ? feeRaw : 0;

  return { officeUserType, facilityId, facilityName, facilityAddress, registrationNumber, defaultMedicalFee };
}
