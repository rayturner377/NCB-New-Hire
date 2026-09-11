'use client';

import { AddressFields } from '../../../../components/form/address-fields';
import { ContactFields } from '../../../../components/form/contact-fields';
import { EmailsField } from '../../../../components/form/emails-field';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { PhoneNumbersField } from '../../../../components/form/phone-numbers-field';
import { PHONE_TYPE_OPTIONS, type PatientCaseData } from '../../patient-case-data';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface PersonalInfoTabProps {
  data: PatientCaseData;
  employeeId: string;
  email: string;
  disabled: boolean;
}

/**
 * Ported from public/app.js's renderPatientMedicalCaseForm tab 0
 * (~L9424-9486) — address, phone numbers, primary physician, and emergency
 * contact reuse the exact same AddressFields/PhoneNumbersField/ContactFields
 * components the candidate form uses (see patient-case-data.ts's top
 * comment), pre-filled from the candidate's existing profile via
 * case-detail-container.tsx rather than asking the patient to retype
 * everything HR already has on file. Consent/signature now live in their own
 * tab — see consent-tab.tsx.
 */
export function PersonalInfoTab({ data, employeeId, email, disabled }: PersonalInfoTabProps) {
  const { personalInfo } = data;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <FormField label="First name" name="personalInfo.firstName" required>
          <Input id="personalInfo.firstName" name="personalInfo.firstName" defaultValue={personalInfo.firstName} required disabled={disabled} />
        </FormField>
        <FormField label="Middle initial" name="personalInfo.middleInitial">
          <Input id="personalInfo.middleInitial" name="personalInfo.middleInitial" defaultValue={personalInfo.middleInitial} disabled={disabled} />
        </FormField>
        <FormField label="Last name" name="personalInfo.lastName" required>
          <Input id="personalInfo.lastName" name="personalInfo.lastName" defaultValue={personalInfo.lastName} required disabled={disabled} />
        </FormField>

        <FormField label="Employee / applicant ID" name="employeeIdDisplay" description="Set by HR — not editable here.">
          <Input id="employeeIdDisplay" defaultValue={employeeId || '—'} readOnly disabled />
        </FormField>
        <FormField label="Sex" name="personalInfo.sex" required>
          <select id="personalInfo.sex" name="personalInfo.sex" defaultValue={personalInfo.sex} required disabled={disabled} className={SELECT_CLASS}>
            <option value="" disabled>
              Select…
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </FormField>
        <FormField label="Marital status" name="personalInfo.maritalStatus">
          <select
            id="personalInfo.maritalStatus"
            name="personalInfo.maritalStatus"
            defaultValue={personalInfo.maritalStatus}
            disabled={disabled}
            className={SELECT_CLASS}
          >
            <option value="">Select…</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="separated">Separated</option>
            <option value="widowed">Widowed</option>
          </select>
        </FormField>
      </div>

      <EmailsField
        name="personalInfo.email"
        defaultValues={personalInfo.emails.length ? personalInfo.emails : email ? [email] : ['']}
        disabled={disabled}
      />

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
        <AddressFields
          namePrefix="personalInfo."
          defaultLine1={personalInfo.addressLine1}
          defaultLine2={personalInfo.addressLine2}
          defaultCity={personalInfo.city}
          defaultState={personalInfo.state}
          defaultCountry={personalInfo.country}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone numbers</p>
        <PhoneNumbersField
          name="personalInfo.contactNumber"
          label="Phone"
          className="max-w-md"
          typeOptions={PHONE_TYPE_OPTIONS}
          defaultTypes={personalInfo.phones.map((p) => p.type)}
          defaultValues={personalInfo.phones.length ? personalInfo.phones.map((p) => p.number) : undefined}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary doctor</p>
        <ContactFields
          legend="Primary physician"
          namePrefix="primaryPhysician"
          namePlaceholder="e.g. Dr. Andre Simms"
          defaultName={data.primaryPhysicianName}
          defaultNumber={data.primaryPhysicianNumber}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contact</p>
        <ContactFields
          legend="Emergency contact"
          namePrefix="emergencyContact"
          namePlaceholder="e.g. John Doe"
          defaultName={data.emergencyContactName}
          defaultNumber={data.emergencyContactNumber}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
