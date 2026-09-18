'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { DateField } from '../../../components/form/date-field';
import { Label } from '../../../components/ui/label';
import { correctCasePaymentDateAction, type CorrectCasePaymentDateResult } from '../actions/correct-case-payment-date';

export interface CasePaymentDateCorrectionProps {
  caseId: string;
}

const initialState: CorrectCasePaymentDateResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save correction'}
    </Button>
  );
}

/**
 * Fixes a wrong payment date without the only path that used to exist (flip "Payment status" back
 * to unpaid on the billing form, which silently un-locks CasePaymentConfirmation again with no
 * distinct record it was a correction). Collapsed behind a toggle rather than always shown next to
 * CasePaymentSummary — this is a rare, corrective action, not part of the normal flow every viewer
 * of a paid case needs in front of them.
 */
export function CasePaymentDateCorrection({ caseId }: CasePaymentDateCorrectionProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(correctCasePaymentDateAction, initialState);

  if (!open) {
    return (
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(true)}>
        Correct payment date
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="caseId" value={caseId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="corrected-paidOn" className="text-xs font-normal text-muted-foreground">
            Corrected date paid
          </Label>
          <DateField name="paidOn" id="corrected-paidOn" required defaultMonth={new Date()} toYear={new Date().getFullYear()} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="corrected-paidOn-reason" className="text-xs font-normal text-muted-foreground">
          Reason
        </Label>
        <textarea
          id="corrected-paidOn-reason"
          name="reason"
          required
          rows={2}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
