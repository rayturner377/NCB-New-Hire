'use client';

import { useActionState, useEffect, useState } from 'react';
import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../../components/ui/dialog';
import { resetCandidatePasswordAction, type ResetCandidatePasswordResult } from '../actions/reset-candidate-password';

export interface ResetCandidatePasswordDialogProps {
  candidateId: string;
}

const initialState: ResetCandidatePasswordResult | null = null;

/**
 * Triggers a password-reset code for a candidate's portal account — covers
 * both "they forgot it" and "we mistyped it at creation." No password field
 * here: the candidate redeems the emailed code themselves at
 * /forgot-password to choose their own new password (see AccessCode's doc
 * comment in schema.prisma for why).
 */
export function ResetCandidatePasswordDialog({ candidateId }: ResetCandidatePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetCandidatePasswordAction, initialState);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reset portal password</DialogTitle>
            <DialogDescription>
              Emails the candidate a 6-digit code to set their own new password. Their current password stops working
              immediately.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="candidateId" value={candidateId} />

          {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <ValidatedSubmitButton formValid label="Send reset code" pendingLabel="Sending…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
