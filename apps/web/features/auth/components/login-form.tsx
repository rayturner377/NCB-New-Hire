'use client';

import { useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { checkSignInMethodAction } from '../actions/check-sign-in-method';
import { login, type LoginResult } from '../actions/login';
import { redeemAccessCodeAction, type RedeemAccessCodeResult } from '../actions/redeem-access-code';
import { requestPasswordResetAction, type RequestPasswordResetResult } from '../actions/request-password-reset';
import { verifyAccessCodeAction, type VerifyAccessCodeResult } from '../actions/verify-access-code';

/**
 * One page, five steps, no navigation between them — replaces the old
 * separate /login + /forgot-password pages. Email is captured once and
 * carried forward through whichever branch the person takes. "Next" checks
 * the server for a live code on that email (checkSignInMethodAction) and
 * picks the branch itself — someone who just received an activation-code
 * email has no password to type and no reason to think to click "Forgot
 * password?", so the page routes them straight to code entry instead of
 * making them guess:
 *
 *   email → Next → [has a live code?] → code → new password → (auto sign-in)
 *                 ↘ [no live code]    → password → (sign in)
 *                                       ↘ "Forgot password?" → code → …
 *
 * Each step past "email" is its own real `<form>` bound to a server action
 * via useActionState (assertSameOrigin, rate limiting, and validation all
 * still happen server-side exactly as before) — this component only owns
 * which step is showing and hands the email/code/password forward as hidden
 * fields, it never second-guesses what the server actions decide.
 */
type Step = 'email' | 'password' | 'sendingCode' | 'code' | 'newPassword' | 'signingIn';

function StepSubmitButton({ pendingLabel, children }: { pendingLabel: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function ChangeEmailLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-primary hover:underline">
      Change
    </button>
  );
}

function EmailSummary({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Email</Label>
      <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
        <span className="truncate">{email}</span>
        <ChangeEmailLink onClick={onChangeEmail} />
      </div>
    </div>
  );
}

export function LoginForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [loginState, loginFormAction] = useActionState<LoginResult | null, FormData>(login, null);
  const [resetState, resetFormAction] = useActionState<RequestPasswordResetResult | null, FormData>(
    requestPasswordResetAction,
    null
  );
  const [verifyState, verifyFormAction] = useActionState<VerifyAccessCodeResult | null, FormData>(
    verifyAccessCodeAction,
    null
  );
  const [redeemState, redeemFormAction] = useActionState<RedeemAccessCodeResult | null, FormData>(
    redeemAccessCodeAction,
    null
  );

  const verifyFormRef = useRef<HTMLFormElement>(null);
  const autoSignInFormRef = useRef<HTMLFormElement>(null);

  // requestPasswordResetAction always resolves ok on a well-formed email (see its own doc comment on
  // why) — this only ever fires from the "sendingCode" step, so a later resend from the "code" step
  // re-triggers the action directly rather than looping back through this effect.
  useEffect(() => {
    if (resetState?.ok && step === 'sendingCode') {
      setStep('code');
    }
  }, [resetState, step]);

  useEffect(() => {
    if (verifyState?.ok && step === 'code') {
      setStep('newPassword');
    }
  }, [verifyState, step]);

  // The account holder just proved they own this code and chose a password — no reason to make them
  // type it again immediately after.
  useEffect(() => {
    if (redeemState?.ok && step === 'newPassword') {
      setStep('signingIn');
    }
  }, [redeemState, step]);

  // Split from the effect above: submitting here (once the 'signingIn' render has actually
  // committed and mounted the hidden form below) rather than right after setStep('signingIn')
  // avoids submitting through a ref that's still null from the previous render.
  useEffect(() => {
    if (step === 'signingIn') {
      autoSignInFormRef.current?.requestSubmit();
    }
  }, [step]);

  function goToEmailStep() {
    setStep('email');
    setCode('');
    setNewPassword('');
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    setCheckingEmail(true);
    const { method } = await checkSignInMethodAction(trimmed);
    setCheckingEmail(false);
    setStep(method === 'code' ? 'code' : 'password');
  }

  function sendResetCode() {
    setStep('sendingCode');
    const formData = new FormData();
    formData.set('email', email);
    resetFormAction(formData);
  }

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    if (digitsOnly.length === 6) {
      // Let the input's own value commit before the form reads it.
      requestAnimationFrame(() => verifyFormRef.current?.requestSubmit());
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {emailError ? <p className="text-xs font-medium text-destructive">{emailError}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={checkingEmail}>
          {checkingEmail ? 'Checking…' : 'Next'}
        </Button>
      </form>
    );
  }

  if (step === 'password') {
    return (
      <div className="flex flex-col gap-4">
        <form action={loginFormAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email} />
          <EmailSummary email={email} onChangeEmail={goToEmailStep} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required autoFocus />
          </div>
          {loginState?.error ? <Alert tone="error">{loginState.error}</Alert> : null}
          <StepSubmitButton pendingLabel="Signing in…">Sign in</StepSubmitButton>
        </form>
        <button type="button" onClick={sendResetCode} className="self-start text-sm font-medium text-primary hover:underline">
          Forgot password?
        </button>
      </div>
    );
  }

  if (step === 'sendingCode' || step === 'code') {
    return (
      <div className="flex flex-col gap-4">
        <EmailSummary email={email} onChangeEmail={goToEmailStep} />

        {step === 'sendingCode' ? (
          <p className="text-sm text-muted-foreground">Sending a code to {email}…</p>
        ) : (
          <form ref={verifyFormRef} action={verifyFormAction} className="flex flex-col gap-4">
            <input type="hidden" name="email" value={email} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">6-digit code</Label>
              <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {email}.</p>
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
              {verifyState?.error ? <p className="text-xs font-medium text-destructive">{verifyState.error}</p> : null}
            </div>
            <StepSubmitButton pendingLabel="Checking…">Verify code</StepSubmitButton>
            <div className="flex items-center justify-between">
              <button type="button" onClick={sendResetCode} className="text-sm font-medium text-primary hover:underline">
                Resend code
              </button>
              <button type="button" onClick={() => setStep('password')} className="text-sm font-medium text-primary hover:underline">
                Sign in with password instead
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (step === 'newPassword') {
    return (
      <form action={redeemFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />
        <Alert tone="success">Code confirmed — choose a new password.</Alert>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            required
            autoFocus
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          {redeemState?.fieldErrors?.password ? (
            <p className="text-xs font-medium text-destructive">{redeemState.fieldErrors.password}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={12} required />
          {redeemState?.fieldErrors?.confirmPassword ? (
            <p className="text-xs font-medium text-destructive">{redeemState.fieldErrors.confirmPassword}</p>
          ) : null}
        </div>
        {redeemState?.error ? <Alert tone="error">{redeemState.error}</Alert> : null}
        <StepSubmitButton pendingLabel="Setting password…">Set new password</StepSubmitButton>
      </form>
    );
  }

  // step === 'signingIn'. login() redirects on success and never returns, so reaching a rendered
  // error here only happens on a genuine failure (e.g. the account got deactivated in the moment
  // between redeeming the code and this auto-submit) — fall back to the ordinary password step
  // rather than leaving the person stuck on a spinner that will never resolve.
  if (loginState?.error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="error">{loginState.error}</Alert>
        <Button type="button" className="w-full" onClick={() => setStep('password')}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-sm text-muted-foreground">Password set — signing you in…</p>
      <form ref={autoSignInFormRef} action={loginFormAction} className="hidden" aria-hidden>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="password" value={newPassword} />
      </form>
    </div>
  );
}
