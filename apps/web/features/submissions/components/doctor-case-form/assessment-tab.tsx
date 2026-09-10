'use client';

import { DateField } from '../../../../components/form/date-field';
import { PhoneNumbersField } from '../../../../components/form/phone-numbers-field';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import type { DoctorAssessmentDraft } from './types';

export interface AssessmentTabProps {
  draft: DoctorAssessmentDraft;
  /** DateField sets its hidden input's value programmatically (picking from the calendar popover, not typing), which doesn't bubble a native change event — this is how the parent's autosave/completeness check still finds out. Unused (but still required to pass) when `disabled`. */
  onFieldChange: () => void;
  /** Read-only display — see submission-viewer.tsx, which reuses this same tab to show a completed submission exactly as the doctor filled it in. */
  disabled?: boolean;
}

/** "Examining physician information" from the paper form — facility/clinician identity, pre-filled from the doctor's own profile (see new-submission-container.tsx) but still editable per case. */
export function AssessmentTab({ draft, onFieldChange, disabled }: AssessmentTabProps) {
  const assessment = draft.assessment ?? {};

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      <FormField label="Medical facility" name="assessment.facilityName" required>
        <Input name="assessment.facilityName" defaultValue={assessment.facilityName ?? ''} required disabled={disabled} />
      </FormField>
      <FormField label="Facility address" name="assessment.facilityAddress">
        <Input name="assessment.facilityAddress" defaultValue={assessment.facilityAddress ?? ''} disabled={disabled} />
      </FormField>
      <FormField label="Assessment date" name="assessment.assessmentDate" required>
        <DateField
          name="assessment.assessmentDate"
          required
          defaultValue={assessment.assessmentDate}
          toYear={new Date().getFullYear()}
          onChange={onFieldChange}
          readOnly={disabled}
        />
      </FormField>
      <FormField label="Physician name" name="assessment.clinicianName" required>
        <Input name="assessment.clinicianName" defaultValue={assessment.clinicianName ?? ''} required disabled={disabled} />
      </FormField>
      <FormField label="Registration number" name="assessment.clinicianRegistrationNumber">
        <Input name="assessment.clinicianRegistrationNumber" defaultValue={assessment.clinicianRegistrationNumber ?? ''} disabled={disabled} />
      </FormField>
      <PhoneNumbersField
        name="assessment.telephoneNumber"
        label="Telephone"
        maxNumbers={1}
        defaultValues={assessment.telephoneNumber ? [assessment.telephoneNumber] : undefined}
        disabled={disabled}
      />
      <FormField label="Fax" name="assessment.faxNumber">
        <Input name="assessment.faxNumber" defaultValue={assessment.faxNumber ?? ''} disabled={disabled} />
      </FormField>
      <FormField label="Email address" name="assessment.emailAddress">
        <Input type="email" name="assessment.emailAddress" defaultValue={assessment.emailAddress ?? ''} disabled={disabled} />
      </FormField>
    </div>
  );
}
