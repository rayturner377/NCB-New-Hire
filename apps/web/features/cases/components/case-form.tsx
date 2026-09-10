'use client';

import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ActionSuccessDialog } from '../../../components/feedback/action-success-dialog';
import { FormSection } from '../../../components/form/form-section';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Combobox } from '../../../components/ui/combobox';
import { Input } from '../../../components/ui/input';
import { FormField } from '../../../components/ui/form-field';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { formatAddress } from '../../../lib/address';
import { splitFullName } from '../../../lib/full-name';
import type { UserSummary } from '../../users/types';
import type { CandidatePayload } from '../../candidates/types';
import { CASE_TYPE_OPTIONS } from '../case-types';
import { createCaseAction, type CaseActionResult } from '../actions/create-case';

const initialState: CaseActionResult | null = null;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Assigning…' : 'Assign medical case'}
    </Button>
  );
}

export interface CaseFormProps {
  candidates: CandidatePayload[];
  doctors: UserSummary[];
}

const SUMMARY_FIELDS: { label: string; render: (candidate: CandidatePayload) => string }[] = [
  { label: 'Applicant ID', render: (c) => c.employeeId },
  { label: 'TRN / national ID', render: (c) => c.nationalId },
  { label: 'Date of birth', render: (c) => c.dateOfBirth },
  { label: 'Phone', render: (c) => c.contactNumber },
  { label: 'Position', render: (c) => c.position },
  { label: 'Email', render: (c) => c.email },
  { label: 'Address', render: (c) => formatAddress(c) },
  { label: 'Primary physician', render: (c) => c.primaryPhysicianName }
];

const NO_DOCTOR = '__none__';

/**
 * Ported from server.js renderNewCaseForm (public/app.js ~L8738-8799), staged
 * as two steps: search for the candidate first (a candidate must already
 * have a profile — this doesn't create one), then — once found — assign a
 * doctor (or leave it for the candidate to pick later) and submit.
 * Medical-office management is deferred, so this assigns a clinician
 * directly rather than an office.
 */
export function CaseForm({ candidates, doctors }: CaseFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(createCaseAction, initialState);
  const [candidateId, setCandidateId] = useState('');
  const [clinicianId, setClinicianId] = useState(NO_DOCTOR);
  const [positionAppliedFor, setPositionAppliedFor] = useState('');
  const [caseType, setCaseType] = useState('');
  const [confirmedCaseId, setConfirmedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok && state.caseId) {
      setConfirmedCaseId(state.caseId);
    }
  }, [state]);

  const candidateOptions = useMemo(
    () => candidates.map((item) => ({ value: item.id, label: item.fullName, description: item.employeeId || item.id })),
    [candidates]
  );
  const candidate = useMemo(() => candidates.find((item) => item.id === candidateId) ?? null, [candidates, candidateId]);
  const doctor = useMemo(() => doctors.find((item) => item.id === clinicianId) ?? null, [doctors, clinicianId]);
  const { firstName, lastName } = candidate ? splitFullName(candidate.fullName) : { firstName: '', lastName: '' };

  function selectCandidate(id: string) {
    setCandidateId(id);
    // Seeds from the candidate's current profile position — a fresh starting point each time a
    // new medical is created, since the role they're applying for this time might differ (see
    // schemas/case.ts's comment); still freely editable below.
    setPositionAppliedFor(candidates.find((item) => item.id === id)?.position ?? '');
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="patientId" value={candidateId} />
      <input type="hidden" name="assignedClinicianId" value={clinicianId === NO_DOCTOR ? '' : clinicianId} />
      <input type="hidden" name="caseType" value={caseType} />

      <FormSection title="1. Search for a candidate" description="A profile must already exist — this doesn't create one.">
        <Combobox
          options={candidateOptions}
          value={candidateId}
          onChange={selectCandidate}
          placeholder="Search by candidate name or employee ID…"
          searchPlaceholder="Type a name or employee ID…"
          emptyText="No candidate found — a profile must be created first."
        />

        {candidate ? (
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 rounded-md bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">First name</span>
              <span className="text-sm">{firstName || 'Not recorded'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Last name</span>
              <span className="text-sm">{lastName || 'Not recorded'}</span>
            </div>
            {SUMMARY_FIELDS.map(({ label, render }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</span>
                <span className="text-sm">{render(candidate) || 'Not recorded'}</span>
              </div>
            ))}
          </div>
        ) : null}
      </FormSection>

      {candidate ? (
        <>
          <Separator />

          <FormSection title="2. Assign medical" description="Leave the doctor blank to let the candidate choose one themselves.">
            <div className="flex max-w-sm flex-col gap-1.5">
              <Label htmlFor="case-type-select">Type of medical</Label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger id="case-type-select">
                  <SelectValue placeholder="Select a type…" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormField
              label="Position applied for"
              name="positionAppliedFor"
              required
              description="Defaults from the candidate's profile — edit if this medical is for a different role."
              className="max-w-sm"
            >
              <Input
                id="positionAppliedFor"
                name="positionAppliedFor"
                type="text"
                maxLength={140}
                value={positionAppliedFor}
                onChange={(event) => setPositionAppliedFor(event.target.value)}
                required
              />
            </FormField>

            <div className="flex max-w-sm flex-col gap-1.5">
              <Label htmlFor="clinician-select">Doctor (optional)</Label>
              <Select value={clinicianId} onValueChange={setClinicianId}>
                <SelectTrigger id="clinician-select">
                  <SelectValue placeholder="No doctor selected — candidate will choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DOCTOR}>No doctor selected — candidate will choose</SelectItem>
                  {doctors.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {doctor
                  ? `Sends this case straight to ${doctor.displayName}.`
                  : 'No doctor selected: this case goes to the candidate first.'}
              </p>
            </div>

            {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

            <div className="flex items-center gap-3">
              <SubmitButton disabled={!caseType} />
              <Button type="button" variant="outline" asChild>
                <Link href="/cases">Cancel</Link>
              </Button>
            </div>
          </FormSection>
        </>
      ) : null}

      <ActionSuccessDialog
        open={confirmedCaseId !== null}
        title="Medical case assigned"
        description={
          doctor
            ? `${candidate?.fullName ?? 'The candidate'}'s medical has been created and assigned to ${doctor.displayName}.`
            : `${candidate?.fullName ?? 'The candidate'}'s medical has been created. They'll choose a doctor to complete it.`
        }
        confirmLabel="View case"
        onConfirm={() => confirmedCaseId && router.push(`/cases/${confirmedCaseId}`)}
      />
    </form>
  );
}
