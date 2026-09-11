'use client';

import { ValidatedSubmitButton } from '../../../components/form/submit-button';
import { Alert } from '../../../components/ui/alert';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { useValidatedForm } from '../../../lib/hooks/use-validated-form';
import { changePasswordAction, type ChangePasswordResult } from '../actions/change-password';
import { useActionState } from 'react';

const initialState: ChangePasswordResult | null = null;

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);
  const { formRef, formValid, refreshValidity, handleSubmit, fieldError } = useValidatedForm(state?.fieldErrors);

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} onChange={refreshValidity} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={12} required />
        {fieldError('password') ? <p className="text-xs font-medium text-destructive">{fieldError('password')}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={12} required />
        {fieldError('confirmPassword') ? <p className="text-xs font-medium text-destructive">{fieldError('confirmPassword')}</p> : null}
      </div>

      {state?.error && !state.fieldErrors ? <Alert tone="error">{state.error}</Alert> : null}

      <ValidatedSubmitButton formValid={formValid} label="Set new password" pendingLabel="Saving…" />
    </form>
  );
}
