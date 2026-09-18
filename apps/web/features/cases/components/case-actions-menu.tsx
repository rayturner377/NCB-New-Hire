'use client';

import { ChevronDown } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { applyCaseActionAction, type ApplyCaseActionResult } from '../actions/apply-case-action';
import { reassignClinicianAction, type ReassignClinicianResult } from '../actions/reassign-clinician';
import { setCaseHiddenAction, type SetCaseHiddenResult } from '../actions/set-case-hidden';
import { availableCaseActions, type CaseActionDefinition } from '../case-transitions';

export interface CaseActionsMenuProps {
  caseId: string;
  version: number;
  status: string;
  role: string;
  /** Locks a reviewed case down to the two reason-required "Reopen" moves — see case-transitions.ts's availableCaseActions. */
  isPaid: boolean;
  canTransition: boolean;
  canReassign: boolean;
  doctors: { id: string; displayName: string }[];
  currentClinicianId: string | null;
  /** Whether this viewer can hide/unhide the case from the doctor/patient queues (see cases-service.ts's setCaseHidden) — independent of canTransition, since hiding isn't a stage change. */
  canHide: boolean;
  hidden: boolean;
}

const applyInitialState: ApplyCaseActionResult | null = null;
const reassignInitialState: ReassignClinicianResult | null = null;
const setHiddenInitialState: SetCaseHiddenResult | null = null;

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

/**
 * The case workspace's top-right "Case actions" menu — replaces the old
 * free-pick status dropdown (any status to any other, no concept of a real
 * workflow) with a small, explicit set of legal moves for the case's
 * current stage and the viewer's role (see case-transitions.ts). Moves that
 * land on the doctor stage — whether that's a first hand-off or sending a
 * reviewed/doctor-submitted case back — open a small dialog to pick who;
 * everything else (sending back to the patient, completing review) is a
 * plain confirm. "Reassign doctor" is separate from these — it doesn't
 * change the case's stage at all, just who's holding it.
 */
export function CaseActionsMenu({
  caseId,
  version,
  status,
  role,
  isPaid,
  canTransition,
  canReassign,
  doctors,
  currentClinicianId,
  canHide,
  hidden
}: CaseActionsMenuProps) {
  const [pendingAction, setPendingAction] = useState<CaseActionDefinition | null>(null);
  const [quickActionId, setQuickActionId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [clinicianId, setClinicianId] = useState(currentClinicianId ?? '');
  const [reason, setReason] = useState('');
  const quickFormRef = useRef<HTMLFormElement>(null);
  const hideFormRef = useRef<HTMLFormElement>(null);

  const [applyState, applyFormAction] = useActionState(applyCaseActionAction, applyInitialState);
  const [reassignState, reassignFormAction] = useActionState(reassignClinicianAction, reassignInitialState);
  const [setHiddenState, setHiddenFormAction] = useActionState(setCaseHiddenAction, setHiddenInitialState);

  // A no-picker action (nothing to choose, just confirm) submits this
  // always-present hidden form rather than calling applyFormAction directly
  // as a plain function — a real submit is what makes useActionState's
  // returned `applyState` reliably reflect the result, the same reason
  // session-idle-manager.tsx's sign-out fix exists.
  useEffect(() => {
    if (quickActionId) {
      quickFormRef.current?.requestSubmit();
      setQuickActionId('');
    }
  }, [quickActionId]);

  useEffect(() => {
    if (applyState?.ok) setPendingAction(null);
  }, [applyState]);
  useEffect(() => {
    if (reassignState?.ok) setReassigning(false);
  }, [reassignState]);

  const actions = canTransition ? availableCaseActions(status, role, isPaid) : [];
  const showReassign = canReassign && status === 'sent_to_doctor';

  if (actions.length === 0 && !showReassign && !canHide) {
    return null;
  }

  function selectAction(action: CaseActionDefinition) {
    if (action.requiresDoctor || action.requiresReason) {
      setClinicianId(currentClinicianId ?? '');
      setReason('');
      setPendingAction(action);
      return;
    }
    if (!window.confirm(`${action.label}?`)) return;
    setQuickActionId(action.id);
  }

  function toggleHidden() {
    const next = !hidden;
    const message = next
      ? "Hide this case from the doctor and patient queues? It stays fully accessible from here and from All cases."
      : 'Unhide this case so it shows up in the doctor/patient queues again?';
    if (!window.confirm(message)) return;
    hideFormRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form ref={quickFormRef} action={applyFormAction} className="hidden">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="actionId" value={quickActionId} />
      </form>

      <form ref={hideFormRef} action={setHiddenFormAction} className="hidden">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="hidden" value={String(!hidden)} />
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Case actions <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <DropdownMenuItem key={action.id} onSelect={() => selectAction(action)}>
              {action.label}
            </DropdownMenuItem>
          ))}
          {showReassign ? (
            <DropdownMenuItem
              onSelect={() => {
                setClinicianId(currentClinicianId ?? '');
                setReassigning(true);
              }}
            >
              Reassign doctor
            </DropdownMenuItem>
          ) : null}
          {canHide ? (
            <DropdownMenuItem onSelect={toggleHidden}>{hidden ? 'Unhide case' : 'Hide from queues'}</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {!pendingAction && !reassigning && applyState?.error ? <Alert tone="error">{applyState.error}</Alert> : null}
      {setHiddenState?.error ? <Alert tone="error">{setHiddenState.error}</Alert> : null}

      <Dialog
        open={Boolean(pendingAction?.requiresDoctor || pendingAction?.requiresReason)}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <form action={applyFormAction}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="actionId" value={pendingAction?.id ?? ''} />
            {pendingAction?.requiresDoctor ? <input type="hidden" name="clinicianId" value={clinicianId} /> : null}
            {pendingAction?.requiresReason ? <input type="hidden" name="reason" value={reason} /> : null}
            <DialogHeader>
              <DialogTitle>{pendingAction?.label}</DialogTitle>
              <DialogDescription>{pendingAction?.description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {pendingAction?.requiresDoctor ? (
                <Select value={clinicianId} onValueChange={setClinicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {pendingAction?.requiresReason ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="case-action-reason">Reason</Label>
                  <textarea
                    id="case-action-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              ) : null}
            </div>

            {applyState?.error ? <Alert tone="error">{applyState.error}</Alert> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingAction(null)}>
                Cancel
              </Button>
              <ConfirmButton label={pendingAction?.label ?? 'Confirm'} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reassigning} onOpenChange={setReassigning}>
        <DialogContent className="sm:max-w-sm">
          <form action={reassignFormAction}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="clinicianId" value={clinicianId} />
            <DialogHeader>
              <DialogTitle>Reassign doctor</DialogTitle>
              <DialogDescription>The case stays at the same stage — only who it&apos;s assigned to changes.</DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Select value={clinicianId} onValueChange={setClinicianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor…" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reassignState?.error ? <Alert tone="error">{reassignState.error}</Alert> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReassigning(false)}>
                Cancel
              </Button>
              <ConfirmButton label="Reassign" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
