export const CASE_TAB_KEYS = ['overview', 'patient', 'doctor', 'billing', 'history', 'documents'] as const;
export type CaseTab = (typeof CASE_TAB_KEYS)[number];

export function resolveCaseTab(value: string | null, canViewHistory: boolean): CaseTab {
  if (!CASE_TAB_KEYS.includes(value as CaseTab) || (value === 'history' && !canViewHistory)) return 'overview';
  return value as CaseTab;
}

/** Shared by the dashboard and full audit log. Use event context, not the case's current status. */
export function caseActivityHref(caseId: string, eventType: string, details: unknown): string {
  let tab: CaseTab = 'history';
  if (eventType === 'case_created' || eventType === 'case_reassigned') tab = 'overview';
  if (eventType === 'case_payment_confirmed' || eventType === 'case_billing_updated') tab = 'billing';
  if (['case_attachment_uploaded', 'case_attachment_downloaded', 'case_attachment_deleted'].includes(eventType)) tab = 'documents';
  if (eventType === 'case_transition' && details && typeof details === 'object' && 'to' in details) {
    if (details.to === 'reviewed' || details.to === 'paid') tab = 'billing';
    if (details.to === 'doctor_submitted') tab = 'doctor';
    if (details.to === 'patient_completed') tab = 'patient';
  }
  const path = `/cases/${encodeURIComponent(caseId)}`;
  return tab === 'overview' ? path : `${path}?tab=${tab}`;
}
