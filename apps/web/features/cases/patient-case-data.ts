/**
 * Shape of MedicalCase.payload.patientCaseData — the patient-facing intake
 * form. Ported field-for-field from the old app's renderPatientMedicalCaseForm
 * (public/app.js ~L9390-9563) and its fixed catalogs (~L9581-9641), with one
 * deliberate departure: address/phone/contact fields match the shape
 * AddressFields/PhoneNumbersField/ContactFields already use for the
 * candidate profile (components/form/*) instead of the old app's own
 * home/mobile/work-phone split and single-string address+physician fields.
 * Reusing those exact components (not just similarly-styled copies) means a
 * candidate's existing address, phone numbers, physician, and emergency
 * contact pre-fill this form instead of asking the patient to retype data HR
 * already collected — see case-detail-container.tsx for where that pre-fill
 * happens. Medical office selection didn't survive the port either (deferred
 * feature) — the patient picks an active doctor directly instead, same as
 * HR does in case-form.tsx.
 */
export interface PatientPersonalInfo {
  firstName: string;
  middleInitial: string;
  lastName: string;
  /** Pre-filled from the candidate's HR-entered profile, editable here (e.g. to fix a typo) — same "starting point, not locked" treatment as address/phone below, unlike Employee ID which stays a pure HR-owned lookup key. */
  dateOfBirth: string;
  /** See dateOfBirth's own comment. Not shown to the doctor/delegate's own read-only view of this data (patient-case-read-only-view.tsx's `hideNationalId`) — it isn't information the examining clinician needs. */
  nationalId: string;
  /** Editable by the patient (unlike the old app, which only ever showed HR's email read-only) — one or more, in case they want to add a personal address alongside the work one HR has on file. */
  emails: string[];
  sex: string;
  maritalStatus: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  /** Typed, unlike the candidate profile's own untyped `contactNumber` list — the old app had separate home/mobile/work fields, so a bare "add another number" list lost that distinction. Each entry's `type` is one of PHONE_TYPE_OPTIONS. */
  phones: PhoneEntry[];
}

export interface PhoneEntry {
  type: string;
  number: string;
}

export const PHONE_TYPE_OPTIONS = ['Mobile', 'Home', 'Work', 'Other'];

export interface FamilyRelativeRow {
  relative: string;
  ageIfAlive: string;
  healthOrCauseOfDeath: string;
  ageAtDeath: string;
}

export interface CatalogAnswer {
  answer: 'yes' | 'no' | '';
  who?: string;
  year?: string;
  detail?: string;
  extra?: Record<string, string>;
}

export interface PatientCaseData {
  personalInfo: PatientPersonalInfo;
  primaryPhysicianName: string;
  primaryPhysicianNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  familyHistory: {
    relatives: FamilyRelativeRow[];
    disorders: Record<string, CatalogAnswer>;
    notes: string;
  };
  medicalHistory: {
    diseases: Record<string, CatalogAnswer>;
    questions: Record<string, CatalogAnswer>;
    notes: string;
  };
  consent: {
    accepted: boolean;
    signedBy: string;
    signedAt: string;
    signatureDataUrl: string;
  };
  assignedClinicianId: string;
}

export interface PatientCaseDataDefaults extends Partial<PatientPersonalInfo> {
  primaryPhysicianName?: string;
  primaryPhysicianNumber?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
}

/** Seeds a brand-new case's form from whatever the candidate profile already has on file — see case-detail-container.tsx. */
export function emptyPatientCaseData(defaults: PatientCaseDataDefaults = {}): PatientCaseData {
  const { primaryPhysicianName, primaryPhysicianNumber, emergencyContactName, emergencyContactNumber, ...personalDefaults } = defaults;

  return {
    personalInfo: {
      firstName: '',
      middleInitial: '',
      lastName: '',
      dateOfBirth: '',
      nationalId: '',
      emails: [],
      sex: '',
      maritalStatus: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: 'Jamaica',
      phones: [],
      ...personalDefaults
    },
    primaryPhysicianName: primaryPhysicianName ?? '',
    primaryPhysicianNumber: primaryPhysicianNumber ?? '',
    emergencyContactName: emergencyContactName ?? '',
    emergencyContactNumber: emergencyContactNumber ?? '',
    familyHistory: { relatives: [{ relative: 'Father', ageIfAlive: '', healthOrCauseOfDeath: '', ageAtDeath: '' }, { relative: 'Mother', ageIfAlive: '', healthOrCauseOfDeath: '', ageAtDeath: '' }], disorders: {}, notes: '' },
    medicalHistory: { diseases: {}, questions: {}, notes: '' },
    consent: { accepted: false, signedBy: '', signedAt: '', signatureDataUrl: '' },
    assignedClinicianId: ''
  };
}

export const FAMILY_RELATIVE_OPTIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Child', 'Other'];

export interface CatalogItem {
  key: string;
  label: string;
}

/** app.js ~L9581-9593 */
export const FAMILY_DISORDER_CATALOG: CatalogItem[] = [
  { key: 'highBloodPressure', label: 'High Blood Pressure' },
  { key: 'heartDisease', label: 'Heart Disease' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'tuberculosis', label: 'Tuberculosis' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'epilepsy', label: 'Epilepsy' },
  { key: 'mentalDisorders', label: 'Mental Disorders' },
  { key: 'paralysis', label: 'Paralysis' }
];

/** app.js ~L9596-9626 */
export const MEDICAL_DISEASE_CATALOG: CatalogItem[] = [
  { key: 'soreThroats', label: 'Frequent sore throats' },
  { key: 'heartAndBloodVesselDisease', label: 'Heart and blood vessel disease' },
  { key: 'urinaryDisorder', label: 'Urinary disorder' },
  { key: 'faintingSpells', label: 'Fainting spells' },
  { key: 'hayFever', label: 'Hay Fever (Allergic Rhinitis)' },
  { key: 'painsInHeartRegion', label: 'Pains in the heart region' },
  { key: 'kidneyTrouble', label: 'Kidney trouble' },
  { key: 'epilepsy', label: 'Epilepsy' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'varicoseVeins', label: 'Varicose veins' },
  { key: 'kidneyStones', label: 'Kidney stones' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'tuberculosis', label: 'Tuberculosis' },
  { key: 'frequentIndigestion', label: 'Frequent indigestion' },
  { key: 'backPain', label: 'Back pain' },
  { key: 'rheumaticFever', label: 'Rheumatic fever' },
  { key: 'pneumonia', label: 'Pneumonia' },
  { key: 'ulcer', label: 'Ulcer of stomach or duodenum' },
  { key: 'jointProblems', label: 'Joint problems' },
  { key: 'frequentHeadaches', label: 'Frequent headaches' },
  { key: 'highBloodPressure', label: 'High blood pressure' },
  { key: 'jaundice', label: 'Jaundice' },
  { key: 'skinDisease', label: 'Skin disease' },
  { key: 'nervousOrMentalDisorder', label: 'Any nervous or mental disorder' },
  { key: 'repeatedBronchitis', label: 'Repeated bronchitis' },
  { key: 'gallStones', label: 'Gall stones' },
  { key: 'sleeplessness', label: 'Sleeplessness' },
  { key: 'chikungunya', label: 'Chikungunya' }
];

export interface MedicalQuestionItem {
  key: string;
  question: string;
  /** 'yesno' pairs an Answer select with a Detail box shown when Yes; 'text'/'textarea' are always-visible free entry. */
  kind: 'yesno' | 'text' | 'textarea';
  detailLabel?: string;
  extraFields?: { key: string; label: string; type: 'text' | 'date' }[];
}

/** app.js ~L9628-9641 */
export const MEDICAL_QUESTION_CATALOG: MedicalQuestionItem[] = [
  { key: 'currentTreatment', question: 'Are you being treated for any condition now?', kind: 'yesno', detailLabel: 'Describe' },
  { key: 'hospitalized', question: 'Have you ever been hospitalized...?', kind: 'yesno', detailLabel: 'Why, where and when?' },
  {
    key: 'workAbsence',
    question: 'Have you ever been absent from work for longer than two weeks through illness?',
    kind: 'yesno',
    detailLabel: 'Describe'
  },
  {
    key: 'neurologyPsychiatry',
    question: 'Have you ever consulted a neurologist, a psychiatrist or a psychoanalyst?',
    kind: 'yesno',
    detailLabel: 'Name and address',
    extraFields: [
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'dateOfConsultation', label: 'Date of consultation', type: 'date' }
    ]
  },
  { key: 'regularMedicine', question: 'Are you taking any medicine regularly?', kind: 'yesno', detailLabel: 'Describe' },
  { key: 'refusedEmployment', question: 'Have you ever been refused employment on health grounds?', kind: 'yesno', detailLabel: 'Describe' },
  {
    key: 'smoking',
    question: 'Do you smoke regularly?',
    kind: 'yesno',
    detailLabel: 'What do you smoke?',
    extraFields: [
      { key: 'yearsSmoked', label: 'Years smoked', type: 'text' },
      { key: 'frequencyPerDay', label: 'Frequency per day', type: 'text' }
    ]
  },
  {
    key: 'alcohol',
    question: 'Do you drink alcoholic beverages?',
    kind: 'yesno',
    detailLabel: 'Describe',
    extraFields: [
      { key: 'frequency', label: 'How often', type: 'text' },
      { key: 'amountPerOccasion', label: 'Amount per occasion', type: 'text' }
    ]
  },
  {
    key: 'futureTreatment',
    question: 'Has any doctor or dentist advised you to undergo medical or surgical treatment in the foreseeable future?',
    kind: 'yesno',
    detailLabel: 'Describe'
  },
  { key: 'otherHealthInfo', question: 'Give any other significant information concerning your health', kind: 'textarea' }
];

/** One run of consent text — `bold` marks the one sentence the paper form itself bolds ("Knowingly providing false..."), not a styling choice made here. */
export interface ConsentTextRun {
  text: string;
  bold?: boolean;
}

export interface ConsentSection {
  heading: string;
  paragraphs: ConsentTextRun[][];
}

/**
 * Verbatim legal text from the paper NCB Pre-Employment Medical Assessment
 * form's "DISCLOSURE AND CONSENT" page, as drafted by the Bank's own
 * lawyers — not paraphrased, and not to be edited without legal sign-off.
 * Structured as sections/paragraphs/runs (rather than one plain string) so
 * both the on-screen ConsentTab and the exported PDF can render the exact
 * same numbered headings and the one bolded sentence from a single source,
 * instead of each carrying its own copy that could drift out of sync with
 * what the patient actually saw and signed under.
 */
export const CONSENT_SECTIONS: ConsentSection[] = [
  {
    heading: '1. Disclosure Notice',
    paragraphs: [
      [
        {
          text: 'The collection of the information on this form is authorized by the applicant for disclosure and will be used to determine the fitness-for-duty. This information may be disclosed to the employees within the Group Human Resources Division of the National Commercial Bank Jamaica Limited for reasons including but not limited to employees’ compensation, retirement, and other benefit entitlements. We may also be required to seek assistance from an expert consultant or other personnel on the Bank’s medical panel which may also lead to the sharing of your medical information. In the case of a dispute regarding discrimination or any other legal matter, your information may also be shared with legal officers of the court. It is also noted that the Bank reserves the right to allow auditors internally and externally to view and assess employees’ information and files for auditing purposes. Completion of this form is voluntary. If this information is not completed, the examination may be considered incomplete and a withdrawal from the employment process. '
        },
        {
          text: 'Knowingly providing false or incomplete answers may result in the rescission of a conditional job offer or dismissal if discovered at a later time.',
          bold: true
        }
      ]
    ]
  },
  {
    heading: '2. Consent and Certification',
    paragraphs: [
      [
        {
          text: 'I hereby authorize collection and use of the medical information obtained for the purposes stated in the above Disclosure Notice and agree to release to the attending Physician, NCB, their medical representative(s) and/or other associates from any and all liability and responsibility arising out of the release of such information.'
        }
      ],
      [
        {
          text: 'I have read and understood the provisions of the Disclosure Notice included in this form. I certify that all the information given by me in connection with this examination will be correct and complete to the best of my knowledge and belief.'
        }
      ],
      [
        {
          text: 'I also understand that if additional medical examinations or assessments are required, this consent will also be extended to those procedures and physicians.'
        }
      ]
    ]
  }
];
