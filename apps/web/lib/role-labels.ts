const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  reviewer: 'Reviewer',
  auditor: 'Auditor',
  clinician: 'Doctor',
  patient: 'Patient'
};

/** Human-readable role name — 'clinician' is the internal role name for a doctor account (see lib/permissions.ts's ROLES), so it needs translating everywhere a role is shown to a person. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
