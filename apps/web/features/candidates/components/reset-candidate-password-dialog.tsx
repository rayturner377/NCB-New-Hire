'use client';

import { useActionState, useEffect, useState } from 'react';
import { ForcePasswordChangeField } from '../../../components/form/force-password-change-field';
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
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { resetCandidatePasswordAction, type ResetCandidatePasswordResult } from '../actions/reset-candidate-password';

export interface ResetCandidatePasswordDialogProps {
  candidateId: string;
}

const initialState: ResetCandidatePasswordResult | null = null;

/**
 * Sets a new temporary password on a candidate's portal account — covers
 * both "they forgot it" and "we mistyped it at creation," neither of which
 * had a fix once the account already existed (only new-candidate creation
 * ever set a password). Same fields/validation as the create form's
 * "Portal access" section (see candidate-form.tsx) and the self-service
 * change-password wizard (changePasswordSchema) — just settable again here.
 */
export function ResetCandidatePasswordDialog({ candidateId }: ResetCandidatePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetCandidatePasswordAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError } = useValidatedForm(state?.fieldErrors);

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
        <form ref={formRef} action={formAction} onSubmit={handleSubmit} onChange={refreshValidity} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reset portal password</DialogTitle>
            <DialogDescription>Sets a new temporary password — share it with the candidate directly.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="candidateId" value={candidateId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <PasswordInput id="reset-password" name="password" autoComplete="new-password" minLength={12} required />
            {fieldError('password') ? <p className="text-xs font-medium text-destructive">{fieldError('password')}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-confirm-password">Confirm new password</Label>
            <PasswordInput id="reset-confirm-password" name="confirmPassword" autoComplete="new-password" minLength={12} required />
            {fieldError('confirmPassword') ? <p className="text-xs font-medium text-destructive">{fieldError('confirmPassword')}</p> : null}
          </div>

          <ForcePasswordChangeField />

          {state?.error && !state.fieldErrors ? <Alert tone="error">{state.error}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <ValidatedSubmitButton formValid={formValid} label="Set new password" pendingLabel="Saving…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
