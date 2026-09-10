'use client';

import { useState } from 'react';
import { Checkbox } from '../../../../components/ui/checkbox';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { SignatureField } from '../../../../components/form/signature-field';
import { captureSignatureTimestamp } from '../../../../lib/signature-timestamp';
import { CONSENT_SECTIONS, type PatientCaseData } from '../../patient-case-data';
import type { UserSummary } from '../../../users/types';
import { DoctorOfficeSelect } from './doctor-office-select';

export interface ConsentTabProps {
  data: PatientCaseData;
  doctors: UserSummary[];
  disabled: boolean;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  signedBy: string;
  onSignedByChange: (value: string) => void;
  onSignatureChange: (dataUrl: string) => void;
  assignedClinicianId: string;
  onAssignedClinicianChange: (id: string) => void;
}

/**
 * Its own tab so consent/signing reads as a distinct step from filling in
 * personal details, rather than one more section at the bottom of a long
 * page. Doctor/medical-office selection lives here too, after signing — the
 * patient signs first, then picks who the signed assessment goes to.
 *
 * `accepted`/`signedBy`/`assignedClinicianId` are controlled by the parent
 * form (see patient-case-form.tsx) rather than owned here, since Submit needs
 * to know all three are satisfied before it can even be clicked.
 */
export function ConsentTab({
  data,
  doctors,
  disabled,
  accepted,
  onAcceptedChange,
  signedBy,
  onSignedByChange,
  onSignatureChange,
  assignedClinicianId,
  onAssignedClinicianChange
}: ConsentTabProps) {
  const { consent } = data;
  const [signedAt, setSignedAt] = useState(consent.signedAt);
  const canSign = accepted && !disabled;

  function handleSignatureChange(dataUrl: string) {
    onSignatureChange(dataUrl);
    if (dataUrl && !signedAt) {
      setSignedAt(captureSignatureTimestamp());
    } else if (!dataUrl) {
      setSignedAt('');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disclosure and Consent</p>

        <div className="flex flex-col gap-4">
          {CONSENT_SECTIONS.map((section) => (
            <div key={section.heading} className="flex flex-col gap-2">
              <p className="text-xs font-bold text-foreground">{section.heading}</p>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-xs leading-relaxed text-muted-foreground">
                  {paragraph.map((run, runIndex) =>
                    run.bold ? (
                      <strong key={runIndex} className="font-bold text-foreground">
                        {run.text}
                      </strong>
                    ) : (
                      <span key={runIndex}>{run.text}</span>
                    )
                  )}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="consent.accepted"
            name="consent.accepted"
            checked={accepted}
            onCheckedChange={(checked) => onAcceptedChange(checked === true)}
            disabled={disabled}
            className="mt-0.5"
          />
          <Label htmlFor="consent.accepted" className="text-sm font-medium leading-snug">
            I agree and consent to this medical assessment.
          </Label>
        </div>

        <div className="flex flex-col gap-4 rounded-md border bg-background p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Sign below</p>
            <p className="text-xs text-muted-foreground">
              {canSign
                ? 'Type your name and it fills in as your signature — or draw your own instead.'
                : 'Check "I agree and consent" above to enable signing.'}
            </p>
          </div>

          <FormField label="Your full name" name="consent.signedBy" required>
            <Input
              id="consent.signedBy"
              name="consent.signedBy"
              value={signedBy}
              onChange={(event) => onSignedByChange(event.target.value)}
              placeholder="e.g. Jane Doe"
              required
              disabled={!canSign}
            />
          </FormField>

          <FormField label="Signature" name="consent.signatureDataUrl">
            <SignatureField
              name="consent.signatureDataUrl"
              defaultValue={consent.signatureDataUrl}
              typedName={signedBy}
              disabled={!canSign}
              onChange={handleSignatureChange}
            />
          </FormField>

          <FormField label="Signed at" name="consent.signedAtDisplay" description="Set automatically once you sign — date, time, and timezone, in case this is ever disputed.">
            <Input id="consent.signedAtDisplay" value={signedAt || 'Not yet signed'} readOnly disabled />
          </FormField>
          <input type="hidden" name="consent.signedAt" value={signedAt} />
        </div>
      </div>

      <FormField label="Doctor / medical office" name="assignedClinicianId" required description="Who will complete your assessment.">
        <DoctorOfficeSelect doctors={doctors} value={assignedClinicianId} onChange={onAssignedClinicianChange} disabled={disabled} />
      </FormField>
    </div>
  );
}
