'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Combobox } from '../../../../components/ui/combobox';
import { Label } from '../../../../components/ui/label';
import type { UserSummary } from '../../../users/types';

function officeUserTypeLabel(value: unknown): string {
  return value === 'clinician' ? 'Clinician / support' : 'Doctor';
}

function doctorProfile(doctor: UserSummary) {
  return doctor.medicalProfile as
    | { officeUserType?: string; facilityName?: string; facilityAddress?: string; registrationNumber?: string }
    | undefined;
}

export interface DoctorOfficeSelectProps {
  doctors: UserSummary[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

/**
 * Ported from public/app.js's bindMedicalOfficeDetails (~L9981) — a live
 * detail card (facility, address, registration, email) that appears once a
 * doctor/office is picked, so the patient can confirm where their assessment
 * is actually headed. Controlled by the parent form (see consent-tab.tsx) so
 * it can gate the Submit button on a doctor actually being chosen.
 *
 * Its own self-titled card (same "Sign below" card treatment consent-tab.tsx
 * already uses above this) rather than a bare full-width `<select>`, with a
 * searchable Combobox (see components/ui/combobox.tsx) instead of a plain
 * dropdown — each option shows its facility right in the list (not a
 * separate hover tooltip, which read as an afterthought floating off to the
 * side) so a patient choosing between several doctors can compare locations
 * while still browsing, not just after committing to one. The trigger is
 * capped to a readable width (`sm:max-w-md`) instead of stretching
 * edge-to-edge the way a bare `<select>`/full-width control would.
 *
 * Not built on select-input.tsx's generic SelectInput since that renders a
 * plain shadcn Select with no room for a description per option — this
 * keeps its own copy of the same required-hidden-input trick (a real,
 * sr-only `type="text"` input rather than `type="hidden"`, which is exempt
 * from constraint validation entirely).
 */
export function DoctorOfficeSelect({ doctors, value, onChange, disabled }: DoctorOfficeSelectProps) {
  const selected = doctors.find((doctor) => doctor.id === value);
  const profile = doctorProfile(selected ?? ({} as UserSummary));
  const hiddenRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [value]);

  const doctorOptions = doctors.map((doctor) => {
    const optionProfile = doctorProfile(doctor);
    const facility = optionProfile?.facilityName || 'No facility on file';
    const address = optionProfile?.facilityAddress;
    return { value: doctor.id, label: doctor.displayName, description: address ? `${facility} — ${address}` : facility };
  });

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="assignedClinicianId" className="text-sm font-medium">
          Doctor / medical office <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">Who will complete your assessment — search by name, each option shows their facility.</p>
      </div>

      <Combobox
        id="assignedClinicianId"
        options={doctorOptions}
        value={value}
        onChange={onChange}
        placeholder="Select a doctor…"
        searchPlaceholder="Search by doctor name…"
        emptyText="No doctor found."
        className="sm:max-w-md"
        disabled={disabled}
      />
      <input
        ref={hiddenRef}
        type="text"
        name="assignedClinicianId"
        required
        value={value}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        disabled={disabled}
      />

      {selected ? (
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:max-w-md">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{profile?.facilityName || 'No facility on file'}</span>
            <span className="text-muted-foreground">{profile?.facilityAddress || 'No address on file'}</span>
            <span className="mt-1 text-xs text-muted-foreground">
              {selected.displayName} · {officeUserTypeLabel(profile?.officeUserType)} · Reg# {profile?.registrationNumber || '—'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
