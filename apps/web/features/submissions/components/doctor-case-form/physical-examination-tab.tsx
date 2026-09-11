'use client';

import { MeasurementInput, type MeasurementUnitOption } from '../../../../components/form/measurement-input';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { Separator } from '../../../../components/ui/separator';
import { PHYSICIAN_EXAM_SECTIONS } from '../../physician-exam-sections';
import type { DoctorAssessmentDraft } from './types';

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/** Mental state and disabilities need room to actually describe something, not a single-line box — everything else on this page is a short finding. */
const TEXTAREA_SECTIONS = new Set(['mentalState', 'disabilities']);

/** A bare number is ambiguous for these two — the doctor picks which scale they're recording in (see components/form/measurement-input.tsx). Keyed by the same PHYSICIAN_EXAM_SECTIONS field key; the unit rides alongside it as `physicalExam.<key>Unit`. */
const MEASUREMENT_UNITS: Record<string, MeasurementUnitOption[]> = {
  height: [
    { value: 'cm', label: 'cm' },
    { value: 'm', label: 'm' },
    { value: 'in', label: 'in' }
  ],
  weight: [
    { value: 'kg', label: 'kg' },
    { value: 'lb', label: 'lb' }
  ]
};

function sectionGridClass(sectionId: string): string {
  if (sectionId === 'disabilities') return 'grid grid-cols-1 gap-x-6 gap-y-3';
  if (sectionId === 'mentalState') return 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2';
  return 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3';
}

export interface PhysicalExaminationTabProps {
  draft: DoctorAssessmentDraft;
  /** From the patient's own intake (personalInfo.sex) — Pregnancy test only applies to female candidates, so it's left off the form entirely rather than shown and required for everyone. Shown by default when unknown (blank/not yet recorded), since hiding a possibly-relevant field is worse than asking a doctor to enter "N/A". */
  patientSex?: string;
  /** Read-only display — see submission-viewer.tsx, which reuses this same tab to show a completed submission exactly as the doctor filled it in. */
  disabled?: boolean;
}

/**
 * "To be completed by the examining physician" — every section and field on
 * that page of the paper form, one input each, driven by the same canonical
 * PHYSICIAN_EXAM_SECTIONS list the read-only submission viewer already
 * groups by (see submission-viewer.tsx) — this is the form half of that
 * mapping, so the two can never drift out of sync on field names or
 * groupings. Every exam field is required — the paper form's own standing
 * instruction is that a blank entry isn't acceptable, and without that this
 * tab had nothing to actually be incomplete about, so it silently showed as
 * done before a doctor had touched it. Laboratory (kept as its own set of
 * quick structured fields rather than the paper form's single freeform note)
 * stays optional — most assessments need no extra tests — and is appended at
 * the end, matching where it sits on the actual page.
 */
export function PhysicalExaminationTab({ draft, patientSex, disabled }: PhysicalExaminationTabProps) {
  const physicalExam = draft.physicalExam ?? {};
  const labResults = draft.labResults ?? {};
  const sections = PHYSICIAN_EXAM_SECTIONS.filter((section) => section.id !== 'pregnancyTest' || patientSex !== 'male');

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, index) => (
        <div key={section.id}>
          {index > 0 ? <Separator className="mb-6" /> : null}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            <div className={sectionGridClass(section.id)}>
              {section.fields.map((field) => {
                const units = MEASUREMENT_UNITS[field.key];
                if (units) {
                  return (
                    <FormField key={field.key} label={field.label} name={`physicalExam.${field.key}`} required>
                      <MeasurementInput
                        valueName={`physicalExam.${field.key}`}
                        unitName={`physicalExam.${field.key}Unit`}
                        units={units}
                        defaultValue={physicalExam[field.key] ?? ''}
                        defaultUnit={physicalExam[`${field.key}Unit`]}
                        required
                        disabled={disabled}
                      />
                    </FormField>
                  );
                }
                if (TEXTAREA_SECTIONS.has(section.id)) {
                  return (
                    <FormField key={field.key} label={field.label} name={`physicalExam.${field.key}`} required>
                      <textarea
                        name={`physicalExam.${field.key}`}
                        rows={3}
                        defaultValue={physicalExam[field.key] ?? ''}
                        required
                        disabled={disabled}
                        className={TEXTAREA_CLASS}
                      />
                    </FormField>
                  );
                }
                return (
                  <FormField key={field.key} label={field.label} name={`physicalExam.${field.key}`} required>
                    <Input name={`physicalExam.${field.key}`} defaultValue={physicalExam[field.key] ?? ''} required disabled={disabled} />
                  </FormField>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <Separator className="mb-2" />

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Laboratory</p>
        <p className="text-xs text-muted-foreground">List any additional laboratory or diagnostic tests required to complete this assessment.</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <FormField label="Blood test" name="labResults.bloodTest">
            <Input name="labResults.bloodTest" defaultValue={labResults.bloodTest ?? ''} disabled={disabled} />
          </FormField>
          <FormField label="Urine test" name="labResults.urineTest">
            <Input name="labResults.urineTest" defaultValue={labResults.urineTest ?? ''} disabled={disabled} />
          </FormField>
          <FormField label="Chest X-ray" name="labResults.chestXray">
            <Input name="labResults.chestXray" defaultValue={labResults.chestXray ?? ''} disabled={disabled} />
          </FormField>
          <FormField label="Drug screen" name="labResults.drugScreen">
            <Input name="labResults.drugScreen" defaultValue={labResults.drugScreen ?? ''} disabled={disabled} />
          </FormField>
        </div>
      </div>
    </div>
  );
}
