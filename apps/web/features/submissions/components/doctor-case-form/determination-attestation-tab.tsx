'use client';

import { useState } from 'react';
import { DateField } from '../../../../components/form/date-field';
import { SignatureField } from '../../../../components/form/signature-field';
import { Checkbox } from '../../../../components/ui/checkbox';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Separator } from '../../../../components/ui/separator';
import type { DoctorAssessmentDraft } from './types';

const DETERMINATION_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'fit_with_restrictions', label: 'Fit with restrictions' },
  { value: 'temporarily_deferred', label: 'Temporarily deferred' },
  { value: 'not_fit', label: 'Not fit' }
];

const FOLLOW_UP_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' }
];

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface DeterminationAttestationTabProps {
  draft: DoctorAssessmentDraft;
  /** Controlled here (not owned inside this component) — Restrictions' visibility and the tab's own completeness both need to know the current value, see doctor-case-form.tsx. */
  determinationStatus: string;
  onDeterminationStatusChange: (value: string) => void;
  /** DateField sets its hidden input's value programmatically, which doesn't bubble a native change event — this is how the parent's autosave still finds out (see assessment-tab.tsx for the same wiring). */
  onFieldChange: () => void;
  signedBy: string;
  onSignedByChange: (value: string) => void;
  signatureDate: string;
  signatureDataUrl: string;
  onSignatureChange: (dataUrl: string) => void;
  consentConfirmed: boolean;
  onConsentConfirmedChange: (value: boolean) => void;
  /** Read-only display — see submission-viewer.tsx, which reuses this same tab to show a completed submission exactly as the doctor filled it in. */
  disabled?: boolean;
}

/**
 * Determination and attestation together on one screen — not enough on
 * either half to justify separate tabs (matching the paper form, where
 * "Conclusions"/the fitness checkbox and the physician's own signature sit
 * on the same page). Signature capture reuses the same SignatureField/
 * timestamp pattern as the patient's own ConsentTab — see consent-tab.tsx and
 * lib/signature-timestamp.ts.
 */
export function DeterminationAttestationTab({
  draft,
  determinationStatus,
  onDeterminationStatusChange,
  onFieldChange,
  signedBy,
  onSignedByChange,
  signatureDate,
  signatureDataUrl,
  onSignatureChange,
  consentConfirmed,
  onConsentConfirmedChange,
  disabled
}: DeterminationAttestationTabProps) {
  const determination = draft.determination ?? {};
  const [followUpRequired, setFollowUpRequired] = useState(Boolean(determination.followUpDate));
  const [followUpDate, setFollowUpDate] = useState(determination.followUpDate ?? '');

  // A fully "Fit" determination has nothing to restrict by definition — asking for restrictions only makes sense once the determination says otherwise.
  const showRestrictions = determinationStatus !== '' && determinationStatus !== 'fit';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Determination</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="determination-status-select">
            Fitness determination<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Select value={determinationStatus} onValueChange={onDeterminationStatusChange} disabled={disabled}>
            <SelectTrigger id="determination-status-select" className="max-w-sm">
              <SelectValue placeholder="Select a determination…" />
            </SelectTrigger>
            <SelectContent>
              {DETERMINATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="determination.status" value={determinationStatus} />
        </div>

        <FormField
          label="Conclusions"
          name="determination.conclusions"
          description="Your opinion on the physical and mental health of the candidate and fitness for duty."
        >
          <textarea
            name="determination.conclusions"
            rows={3}
            defaultValue={determination.conclusions ?? ''}
            disabled={disabled}
            className={TEXTAREA_CLASS}
          />
        </FormField>

        {showRestrictions ? (
          <FormField label="Restrictions" name="determination.restrictions">
            <textarea
              name="determination.restrictions"
              rows={2}
              defaultValue={determination.restrictions ?? ''}
              disabled={disabled}
              className={TEXTAREA_CLASS}
            />
          </FormField>
        ) : (
          <input type="hidden" name="determination.restrictions" value="" />
        )}

        <FormField label="Recommendation" name="determination.recommendation">
          <textarea
            name="determination.recommendation"
            rows={2}
            defaultValue={determination.recommendation ?? ''}
            disabled={disabled}
            className={TEXTAREA_CLASS}
          />
        </FormField>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="determination-followup-select">Follow-up visit required?</Label>
            <Select
              value={followUpRequired ? 'yes' : 'no'}
              onValueChange={(value) => {
                const required = value === 'yes';
                setFollowUpRequired(required);
                if (!required) setFollowUpDate('');
                onFieldChange();
              }}
              disabled={disabled}
            >
              <SelectTrigger id="determination-followup-select" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {followUpRequired ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="determination-followup-date">
                Follow-up date<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <DateField
                id="determination-followup-date"
                name="determination.followUpDate"
                required
                defaultValue={followUpDate}
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 5}
                onValueChange={setFollowUpDate}
                onChange={onFieldChange}
                readOnly={disabled}
              />
            </div>
          ) : (
            <input type="hidden" name="determination.followUpDate" value="" />
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attestation</p>

        <FormField label="Signed by" name="attestation.signedBy" required>
          <Input
            name="attestation.signedBy"
            value={signedBy}
            onChange={(event) => onSignedByChange(event.target.value)}
            required
            disabled={disabled}
          />
        </FormField>

        <FormField label="Signature" name="attestation.signatureDataUrl">
          <SignatureField
            name="attestation.signatureDataUrl"
            defaultValue={signatureDataUrl}
            typedName={signedBy}
            onChange={onSignatureChange}
            disabled={disabled}
          />
        </FormField>

        <FormField
          label="Signed at"
          name="attestation.signatureDateDisplay"
          description="Set automatically once you sign — date, time, and timezone, in case this is ever disputed."
        >
          <Input value={signatureDate || 'Not yet signed'} readOnly disabled />
        </FormField>
        <input type="hidden" name="attestation.signatureDate" value={signatureDate} />

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="attestation.consentConfirmed"
            name="attestation.consentConfirmed"
            value="true"
            checked={consentConfirmed}
            onCheckedChange={(checked) => onConsentConfirmedChange(checked === true)}
            disabled={disabled}
            className="mt-0.5"
          />
          <Label htmlFor="attestation.consentConfirmed" className="text-sm font-medium leading-snug">
            I confirm the candidate&apos;s consent was obtained before this assessment.
          </Label>
        </div>
      </div>
    </div>
  );
}
