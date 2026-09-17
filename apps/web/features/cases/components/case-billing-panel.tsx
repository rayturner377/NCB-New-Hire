import { SelectField } from '../../../components/form/select-field';
import { Button } from '../../../components/ui/button';
import { updateCaseBillingAction } from '../actions/update-case-billing';
import { BILLING_STATUS_OPTIONS, derivedPaymentStatus } from '../billing-status';
import { CasePaymentConfirmation } from './case-payment-confirmation';
import { CasePaymentSummary } from './case-payment-summary';
import { CompleteReviewCard } from './complete-review-card';
import { formatCurrency } from '../../../lib/currency';
import { statusLabel } from '../../../lib/status-labels';
import type { CaseWorkspaceCapabilities } from '../case-workspace-capabilities';

export interface CaseBillingPanelProps {
  caseId: string;
  version: number;
  status: string;
  /** A Prisma Decimal at the call site — typed loosely here since this component only ever coerces it via Number()/truthiness, never inspects it directly. */
  payableAmount: unknown;
  paymentStatus: string | null;
  paidOn: string | null;
  paymentConfirmedByName: string | null;
  capabilities: Pick<
    CaseWorkspaceCapabilities,
    | 'awaitingReview'
    | 'canTransition'
    | 'canUpdateBilling'
    | 'canViewBilling'
    | 'canConfirmPayment'
    | 'isPaid'
    | 'billingLocked'
    | 'billingLockedMessage'
    | 'doctorHasSubmitted'
  >;
}

/** The case detail page's "Billing & status" tab content — review completion, the billing form (or its read-only equivalent), and payment confirmation/summary. */
export function CaseBillingPanel({ caseId, version, status, payableAmount, paymentStatus, paidOn, paymentConfirmedByName, capabilities }: CaseBillingPanelProps) {
  const { awaitingReview, canTransition, canUpdateBilling, canViewBilling, canConfirmPayment, isPaid, billingLocked, billingLockedMessage, doctorHasSubmitted } =
    capabilities;

  return (
    <>
      {awaitingReview && canTransition ? <CompleteReviewCard caseId={caseId} version={version} /> : null}

      {canUpdateBilling ? (
        <form action={updateCaseBillingAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <fieldset disabled={billingLocked} className="contents">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="payableAmount" className="text-xs font-medium text-muted-foreground">
                Payable amount
              </label>
              <input
                id="payableAmount"
                name="payableAmount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={payableAmount ? Number(payableAmount) : ''}
                className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <SelectField
              name="paymentStatus"
              label="Payment status"
              defaultValue={derivedPaymentStatus(status, paymentStatus)}
              options={BILLING_STATUS_OPTIONS.map((option) => ({ value: option, label: statusLabel(option) }))}
              className="h-9 w-44"
              disabled={billingLocked}
            />
            <Button type="submit" size="sm" variant="secondary">
              Save billing
            </Button>
          </fieldset>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Payment status</dt>
            <dd className="text-sm">{paymentStatus ? statusLabel(paymentStatus) : '—'}</dd>
          </div>
          {canViewBilling ? (
            <div className="flex flex-col">
              <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Payable amount</dt>
              <dd className="text-sm">{payableAmount ? formatCurrency(Number(payableAmount)) : '—'}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {canUpdateBilling ? (
        <p className="text-xs text-muted-foreground">
          {!doctorHasSubmitted
            ? "Available once the doctor's assessment has been submitted — there's nothing to bill before then."
            : awaitingReview
              ? 'Complete review above before adjusting billing.'
              : "Set automatically from the doctor's rate when they submit their assessment — adjusting it here doesn't change that doctor's own rate, only this case's billed amount."}
        </p>
      ) : null}

      {isPaid ? (
        <CasePaymentSummary paidOn={paidOn} confirmedByName={paymentConfirmedByName} />
      ) : canConfirmPayment ? (
        <CasePaymentConfirmation caseId={caseId} lockedMessage={billingLockedMessage} />
      ) : null}
    </>
  );
}
