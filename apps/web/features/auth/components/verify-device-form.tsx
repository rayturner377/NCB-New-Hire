'use client';

import Link from 'next/link';
import { useActionState, useRef, useState, type ChangeEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { resendDeviceCodeAction } from '../actions/resend-device-code';
import { verifyDeviceCodeAction, type VerifyDeviceCodeResult } from '../actions/verify-device-code';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Verifying…' : 'Verify code'}
    </Button>
  );
}

/** Same code-entry pattern as login-form.tsx's own "code" step (auto-submit once 6 digits are typed) — no email/password fields here, since identity was already proven at sign-in and the plugin's own signed cookie carries who's mid-verification. */
export function VerifyDeviceForm() {
  const [state, formAction] = useActionState<VerifyDeviceCodeResult | null, FormData>(verifyDeviceCodeAction, null);
  const [code, setCode] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    setResendMessage(null);
    if (digitsOnly.length === 6) {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  async function handleResend() {
    setResendMessage(null);
    const result = await resendDeviceCodeAction();
    setResendMessage(result.ok ? 'A new code has been sent.' : (result.error ?? 'Something went wrong.'));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          autoFocus
          value={code}
          onChange={handleCodeChange}
        />
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {resendMessage ? <p className="text-xs text-muted-foreground">{resendMessage}</p> : null}

      <SubmitButton />

      <div className="flex items-center justify-between">
        <button type="button" onClick={handleResend} className="text-sm font-medium text-primary hover:underline">
          Resend code
        </button>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
