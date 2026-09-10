import { combineContactNumbers } from '../../lib/phone-number';
import {
  FAMILY_DISORDER_CATALOG,
  MEDICAL_DISEASE_CATALOG,
  MEDICAL_QUESTION_CATALOG,
  type CatalogAnswer,
  type FamilyRelativeRow,
  type PatientCaseData,
  type PhoneEntry
} from './patient-case-data';

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

/** Zips PhoneNumbersField's `${name}` (E.164 numbers) and `${name}Type` (type per entry) arrays back into pairs, dropping blank numbers. */
function parsePhoneEntries(formData: FormData, name: string): PhoneEntry[] {
  const numbers = formData.getAll(name).map(String);
  const types = formData.getAll(`${name}Type`).map(String);
  return numbers
    .map((number, index) => ({ type: types[index]?.trim() || 'Mobile', number: number.trim() }))
    .filter((entry) => entry.number);
}

/**
 * Reconstructs the nested PatientCaseData shape from the submitted form's
 * flat field names. Family relative rows are dynamic (added/removed by the
 * user), so they're submitted as four parallel same-named arrays — one entry
 * per row, in row order — and zipped back together here. The fixed catalogs
 * (family disorders, diseases, questions) render one row per catalog item,
 * so those are addressed directly by `<catalogKey>.<field>` names instead.
 */
export function parsePatientCaseData(formData: FormData): PatientCaseData {
  const relativeNames = formData.getAll('familyRelative.relative').map(String);
  const relativeAges = formData.getAll('familyRelative.ageIfAlive').map(String);
  const relativeHealth = formData.getAll('familyRelative.healthOrCauseOfDeath').map(String);
  const relativeAgeAtDeath = formData.getAll('familyRelative.ageAtDeath').map(String);
  const relatives: FamilyRelativeRow[] = relativeNames.map((relative, index) => ({
    relative,
    ageIfAlive: relativeAges[index] ?? '',
    healthOrCauseOfDeath: relativeHealth[index] ?? '',
    ageAtDeath: relativeAgeAtDeath[index] ?? ''
  }));

  const disorders: Record<string, CatalogAnswer> = {};
  for (const item of FAMILY_DISORDER_CATALOG) {
    disorders[item.key] = {
      answer: (str(formData, `disorder.${item.key}.answer`) as CatalogAnswer['answer']) || '',
      who: str(formData, `disorder.${item.key}.who`)
    };
  }

  const diseases: Record<string, CatalogAnswer> = {};
  for (const item of MEDICAL_DISEASE_CATALOG) {
    diseases[item.key] = {
      answer: (str(formData, `disease.${item.key}.answer`) as CatalogAnswer['answer']) || '',
      year: str(formData, `disease.${item.key}.year`)
    };
  }

  const questions: Record<string, CatalogAnswer> = {};
  for (const item of MEDICAL_QUESTION_CATALOG) {
    if (item.kind === 'text' || item.kind === 'textarea') {
      questions[item.key] = { answer: '', detail: str(formData, `question.${item.key}.detail`) };
      continue;
    }
    const extra: Record<string, string> = {};
    for (const field of item.extraFields ?? []) {
      extra[field.key] = str(formData, `question.${item.key}.extra.${field.key}`);
    }
    questions[item.key] = {
      answer: (str(formData, `question.${item.key}.answer`) as CatalogAnswer['answer']) || '',
      detail: str(formData, `question.${item.key}.detail`),
      extra
    };
  }

  return {
    personalInfo: {
      firstName: str(formData, 'personalInfo.firstName'),
      middleInitial: str(formData, 'personalInfo.middleInitial'),
      lastName: str(formData, 'personalInfo.lastName'),
      emails: formData
        .getAll('personalInfo.email')
        .map((value) => String(value).trim())
        .filter(Boolean),
      sex: str(formData, 'personalInfo.sex'),
      maritalStatus: str(formData, 'personalInfo.maritalStatus'),
      addressLine1: str(formData, 'personalInfo.addressLine1'),
      addressLine2: str(formData, 'personalInfo.addressLine2'),
      city: str(formData, 'personalInfo.city'),
      state: str(formData, 'personalInfo.state'),
      country: str(formData, 'personalInfo.country'),
      phones: parsePhoneEntries(formData, 'personalInfo.contactNumber')
    },
    primaryPhysicianName: str(formData, 'primaryPhysicianName'),
    primaryPhysicianNumber: combineContactNumbers(formData, 'primaryPhysicianNumber'),
    emergencyContactName: str(formData, 'emergencyContactName'),
    emergencyContactNumber: combineContactNumbers(formData, 'emergencyContactNumber'),
    familyHistory: {
      relatives,
      disorders,
      notes: str(formData, 'familyHistory.notes')
    },
    medicalHistory: {
      diseases,
      questions,
      notes: str(formData, 'medicalHistory.notes')
    },
    consent: {
      accepted: formData.get('consent.accepted') != null,
      signedBy: str(formData, 'consent.signedBy'),
      signedAt: str(formData, 'consent.signedAt'),
      signatureDataUrl: str(formData, 'consent.signatureDataUrl')
    },
    assignedClinicianId: str(formData, 'assignedClinicianId')
  };
}
