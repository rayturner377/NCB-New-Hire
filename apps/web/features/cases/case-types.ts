/**
 * The kinds of medical a case can be for, chosen by HR when the case is
 * created. Hardcoded for now — the plan is to move this list into an
 * admin-configurable settings table once settings exist, the same
 * loosely-coupled shape as a doctor's billing rate (see
 * cases-service.ts's setCaseBilling comment) — nothing that reads a case's
 * type should need to change when that happens, only where the list of
 * choices comes from.
 */
export const CASE_TYPES = ['pre_employment', 'required_medical', 'emergency_medical'] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  pre_employment: 'Pre-employment',
  required_medical: 'Required medical',
  emergency_medical: 'Emergency medical'
};

export const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = CASE_TYPES.map((value) => ({
  value,
  label: CASE_TYPE_LABELS[value]
}));

/** Falls back to the raw stored value for a case created before this field existed, or one whose type isn't in the current list. */
export function caseTypeLabel(caseType: string | undefined | null): string {
  if (!caseType) return 'Not set';
  return CASE_TYPE_LABELS[caseType as CaseType] ?? caseType;
}
