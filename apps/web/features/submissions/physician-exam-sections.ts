export interface PhysicianExamField {
  key: string;
  label: string;
}

export interface PhysicianExamSection {
  id: string;
  title: string;
  fields: PhysicianExamField[];
}

/**
 * Ported from server.js's physicianExamSections (public/app.js ~L321) — the
 * full physical-exam field list. Not wired into a doctor-authoring form yet
 * (that rebuild is deferred); for now this only drives the read-only case
 * viewer's field labels/grouping when a submission's `physicalExam` record
 * has these keys.
 */
export const PHYSICIAN_EXAM_SECTIONS: PhysicianExamSection[] = [
  {
    id: 'generalAppearance',
    title: 'General Appearance',
    fields: [
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' }
    ]
  },
  {
    id: 'noseMouthNeck',
    title: 'Nose-Mouth-Neck',
    fields: [
      { key: 'nose', label: 'Nose' },
      { key: 'pharynx', label: 'Pharynx' },
      { key: 'teeth', label: 'Teeth' },
      { key: 'tongue', label: 'Tongue' },
      { key: 'tonsils', label: 'Tonsils' },
      { key: 'thyroid', label: 'Thyroid' }
    ]
  },
  {
    id: 'cardiovascular',
    title: 'Cardiovascular System',
    fields: [
      { key: 'pulseRate', label: 'Pulse rate' },
      { key: 'rhythm', label: 'Rhythm' },
      { key: 'bloodPressure', label: 'Blood pressure' },
      { key: 'varicoseVeins', label: 'Varicose veins' },
      { key: 'cyanosis', label: 'Presence of cyanosis' },
      { key: 'mucusMembrane', label: 'Mucus membrane' }
    ]
  },
  {
    id: 'respiratory',
    title: 'Respiratory System',
    fields: [
      { key: 'thorax', label: 'Thorax' },
      { key: 'breasts', label: 'Breasts' }
    ]
  },
  {
    id: 'nervous',
    title: 'Nervous System',
    fields: [
      { key: 'fundi', label: 'Fundi' },
      { key: 'reflexes', label: 'Reflexes' },
      { key: 'sensation', label: 'Sensation' },
      { key: 'tremors', label: 'Tremors' }
    ]
  },
  {
    id: 'mentalState',
    title: 'Mental State',
    fields: [
      { key: 'mentalAppearance', label: 'Appearance' },
      { key: 'behaviour', label: 'Behaviour' }
    ]
  },
  {
    id: 'genitoUrinary',
    title: 'Genito-Urinary System',
    fields: [
      { key: 'kidneys', label: 'Kidneys' },
      { key: 'organs', label: 'Organs' }
    ]
  },
  {
    id: 'skeletal',
    title: 'Skeletal System',
    fields: [
      { key: 'skull', label: 'Skull' },
      { key: 'spine', label: 'Spine' },
      { key: 'upperExtremities', label: 'Upper extremities' },
      { key: 'lowerExtremities', label: 'Lower extremities' }
    ]
  },
  {
    id: 'disabilities',
    title: 'Disabilities',
    fields: [{ key: 'disabilities', label: 'Disabilities' }]
  },
  {
    id: 'pregnancyTest',
    title: 'Pregnancy Test',
    fields: [{ key: 'pregnancyTest', label: 'Pregnancy test' }]
  }
];

const LABEL_BY_KEY = new Map(PHYSICIAN_EXAM_SECTIONS.flatMap((section) => section.fields).map((field) => [field.key, field.label]));

/** Falls back to a humanized key (camelCase -> "Camel Case") for any field not in the canonical list — e.g. today's simplified vitals.*. */
export function physicianExamFieldLabel(key: string): string {
  const known = LABEL_BY_KEY.get(key);
  if (known) return known;
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}
