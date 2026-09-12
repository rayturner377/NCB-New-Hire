'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { redeemAccessCodeAction, type RedeemAccessCodeResult } from '../actions/redeem-access-code';

const initialState: RedeemAccessCodeResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Setting password…' : 'Set new password'}
    </Button>
  );
}

/**
 * Redeems an account-activation or password-reset code (see access-codes-service.ts's
 * redeemAccessCode — the same form covers both) and lets the account holder
 * choose their own new password. No admin/HR ever sees or sets this password.
 */
export function RedeemAccessCodeForm() {
  const [state, formAction] = useActionState(redeemAccessCodeAction, initialState);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">Your password has been set. You can now sign in.</Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input id="code" name="code" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required />
        {state?.fieldErrors?.code ? <p className="text-xs font-medium text-destructive">{state.fieldErrors.code}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={12} required />
        {state?.fieldErrors?.password ? <p className="text-xs font-medium text-destructive">{state.fieldErrors.password}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={12} required />
        {state?.fieldErrors?.confirmPassword ? (
          <p className="text-xs font-medium text-destructive">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton />
    </form>
  );
}
