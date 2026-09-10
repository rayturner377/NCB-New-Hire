'use client';

import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { DateField } from '../../../components/form/date-field';
import { confirmCasePaymentAction, type ConfirmCasePaymentResult } from '../actions/confirm-case-payment';
import { useActionState } from 'react';

export interface CasePaymentConfirmationProps {
  caseId: string;
  /** Set to grey out the form instead of hiding it — the reason shown below it (no submission yet, or still awaiting review). Omit/undefined to leave it enabled. */
  lockedMessage?: string;
}

const initialState: ConfirmCasePaymentResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Confirming…' : 'Confirm payment'}
    </Button>
  );
}

/**
 * The review queue's own exit condition — a case sits in HR's queue until
 * this is submitted (see cases-service.ts's listReviewQueueCases). Its own
 * form (not the direct-call pattern CaseAttachmentUpload uses) because
 * nothing here sits nested inside another <form> — the Billing tab it lives
 * in is plain tab content, not a bigger submission form.
 */
export function CasePaymentConfirmation({ caseId, lockedMessage }: CasePaymentConfirmationProps) {
  const [state, formAction] = useActionState(confirmCasePaymentAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Confirm payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <fieldset disabled={Boolean(lockedMessage)} className="contents">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paidOn" className="text-xs font-normal text-muted-foreground">
                Date paid
              </Label>
              <DateField name="paidOn" id="paidOn" required defaultMonth={new Date()} toYear={new Date().getFullYear()} />
            </div>
            <SubmitButton />
          </fieldset>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          {lockedMessage ?? 'Marks this case as paid and records that you confirmed it — the case then drops off the review queue.'}
        </p>
        {state && !state.ok ? (
          <div className="mt-2">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
