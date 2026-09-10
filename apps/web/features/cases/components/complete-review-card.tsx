'use client';

import { useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { applyCaseActionAction, type ApplyCaseActionResult } from '../actions/apply-case-action';
import { useActionState } from 'react';

export interface CompleteReviewCardProps {
  caseId: string;
  version: number;
}

const initialState: ApplyCaseActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Completing…' : 'Complete review'}
    </Button>
  );
}

/**
 * The exact same `complete_review` case action the "Case actions" menu
 * already exposes (case-transitions.ts) — surfaced a second time right where
 * a reviewer actually needs it. CasePdfExport's locked message tells them to
 * "mark this case as reviewed on the Billing & status tab," but until this
 * existed that tab had no such control, only the header's dropdown menu; this
 * closes that gap instead of making them go hunting for it. Billing/payment
 * editing is also gated on this same status (see case-detail-container.tsx's
 * `awaitingReview`), so completing review from right here immediately
 * unlocks the fields sitting just below it.
 */
export function CompleteReviewCard({ caseId, version }: CompleteReviewCardProps) {
  const [state, formAction] = useActionState(applyCaseActionAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Complete review</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="actionId" value="complete_review" />
          <SubmitButton />
          <p className="text-xs text-muted-foreground">
            Marks HR review as done — billing, payment, and export all unlock once this case is reviewed.
          </p>
        </form>
        {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      </CardContent>
    </Card>
  );
}
