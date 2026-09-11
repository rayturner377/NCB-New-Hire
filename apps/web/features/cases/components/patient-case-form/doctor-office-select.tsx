'use client';

import type { UserSummary } from '../../../users/types';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function officeUserTypeLabel(value: unknown): string {
  return value === 'clinician' ? 'Clinician / support' : 'Doctor';
}

export interface DoctorOfficeSelectProps {
  doctors: UserSummary[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

/** Ported from public/app.js's bindMedicalOfficeDetails (~L9981) — a live detail card (facility, address, registration, email) that appears once a doctor/office is picked, so the patient can confirm where their assessment is actually headed. Controlled by the parent form (see consent-tab.tsx) so it can gate the Submit button on a doctor actually being chosen. */
export function DoctorOfficeSelect({ doctors, value, onChange, disabled }: DoctorOfficeSelectProps) {
  const selected = doctors.find((doctor) => doctor.id === value);
  const profile = selected?.medicalProfile as
    | { officeUserType?: string; facilityName?: string; facilityAddress?: string; registrationNumber?: string }
    | undefined;

  return (
    <div className="flex flex-col gap-3">
      <select
        name="assignedClinicianId"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={disabled}
        className={SELECT_CLASS}
      >
        <option value="" disabled>
          Select a doctor…
        </option>
        {doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctor.displayName}
          </option>
        ))}
      </select>

      {selected ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Facility</span>
            <span>{profile?.facilityName || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Facility address</span>
            <span>{profile?.facilityAddress || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Type</span>
            <span>{officeUserTypeLabel(profile?.officeUserType)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Registration number</span>
            <span>{profile?.registrationNumber || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Doctor</span>
            <span>{selected.displayName}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Email</span>
            <span>{selected.email}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
