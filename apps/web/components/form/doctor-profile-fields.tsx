'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface DoctorProfileFieldsOffice {
  id: string;
  name: string;
  address: string | null;
}

export interface DoctorProfileFieldsProps {
  /** Active facilities to choose from — see features/medical-offices. */
  offices: DoctorProfileFieldsOffice[];
  defaultOfficeUserType?: 'doctor' | 'clinician';
  defaultFacilityId?: string;
  defaultRegistrationNumber?: string;
  defaultFee?: number;
}

/**
 * Doctor-only account fields — ported from server.js's doctorSetupForm
 * (public/app.js ~L8193-8212)/sanitizeMedicalProfile (server.js ~L5049-5061).
 * Facility used to be two free-text inputs (name + address, easy to
 * mistype/duplicate); it's now a picker over real MedicalOffice records
 * (features/medical-offices) — picking one shows its address read-only
 * below and carries the facility's id (`facilityId`) plus a name/address
 * snapshot (hidden inputs) so existing readers of `medicalProfile.facilityName`/
 * `facilityAddress` (e.g. the patient case form's doctor picker) keep working
 * unchanged. "Doctor rate" only matters for actual doctors — clinician/
 * support staff at the same facility don't bill a rate, so the field hides
 * for that choice, and is intentionally its own value here rather than the
 * facility's default rate — see MedicalOfficeForm's "Default rate" field
 * description for why the two are only a starting point, not linked.
 *
 * Both dropdowns here are shadcn's Select (Radix, styled) rather than a bare
 * `<select>` — same as every other dropdown in the app — paired with a
 * hidden input carrying its value into the real `<form>`'s FormData, since
 * Select itself doesn't participate in native form submission.
 */
export function DoctorProfileFields({
  offices,
  defaultOfficeUserType = 'doctor',
  defaultFacilityId = '',
  defaultRegistrationNumber = '',
  defaultFee
}: DoctorProfileFieldsProps) {
  const [officeUserType, setOfficeUserType] = useState(defaultOfficeUserType);
  const [facilityId, setFacilityId] = useState(defaultFacilityId);
  const selectedOffice = offices.find((office) => office.id === facilityId);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <FormField label="Office user type" name="officeUserType">
        <Select value={officeUserType} onValueChange={(value) => setOfficeUserType(value as 'doctor' | 'clinician')}>
          <SelectTrigger id="officeUserType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="doctor">Doctor</SelectItem>
            <SelectItem value="clinician">Clinician / support</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="officeUserType" value={officeUserType} />
      </FormField>

      {officeUserType === 'doctor' ? (
        <FormField label="Doctor rate" name="defaultMedicalFee" description="Per-medical fee, used for billing.">
          <Input id="defaultMedicalFee" name="defaultMedicalFee" type="number" min={0} step="0.01" defaultValue={defaultFee} />
        </FormField>
      ) : null}

      <FormField
        label="Medical facility"
        name="facilityId"
        description={offices.length === 0 ? undefined : 'Picking a facility fills in its address below.'}
      >
        {offices.length === 0 ? (
          <p className="flex h-9 items-center text-sm text-muted-foreground">
            No facilities yet —{' '}
            <Link href="/medical-offices/new" className="ml-1 text-primary hover:underline">
              create one first
            </Link>
            .
          </p>
        ) : (
          <>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger id="facilityId">
                <SelectValue placeholder="Select a facility…" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="facilityId" value={facilityId} />
          </>
        )}
      </FormField>

      {selectedOffice ? (
        <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 sm:col-span-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Facility address</span>
          <span className="text-sm">{selectedOffice.address || 'No address on file'}</span>
        </div>
      ) : null}
      <input type="hidden" name="facilityName" value={selectedOffice?.name ?? ''} />
      <input type="hidden" name="facilityAddress" value={selectedOffice?.address ?? ''} />

      <FormField label="Registration / license number" name="registrationNumber">
        <Input id="registrationNumber" name="registrationNumber" type="text" defaultValue={defaultRegistrationNumber} placeholder="e.g. MED-10234" />
      </FormField>
    </div>
  );
}
