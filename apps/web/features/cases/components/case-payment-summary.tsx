export interface CasePaymentSummaryProps {
  paidOn: string | null;
  confirmedByName: string | null;
}

/**
 * Read-only "who confirmed this was paid, and when" — shown once a case's
 * payment has been confirmed (see CasePaymentConfirmation, the form that
 * produces this), sourced from the case's own case_payment_confirmed audit
 * event rather than dedicated columns (see cases-service.ts's
 * confirmCasePayment for why).
 */
export function CasePaymentSummary({ paidOn, confirmedByName }: CasePaymentSummaryProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <div className="flex flex-col">
        <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Date paid</dt>
        <dd className="text-sm">{paidOn ?? '—'}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Confirmed by</dt>
        <dd className="text-sm">{confirmedByName ?? '—'}</dd>
      </div>
    </dl>
  );
}
