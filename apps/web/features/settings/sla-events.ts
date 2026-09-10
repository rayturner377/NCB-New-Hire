/**
 * Fixed catalog of case milestones an SLA policy can measure between — each
 * tied to a real, queryable timestamp (a MedicalCase column, never something
 * derived from `updatedAt`, which changes on any unrelated edit). This list
 * is not admin-editable — new milestones only show up here once the
 * underlying schema actually records them (see MedicalCase in schema.prisma)
 * — but which pairs of them form a *policy*, and what target/warning
 * thresholds apply, is fully admin-configurable (see types.ts's SlaDefinition
 * and sla-settings-form.tsx).
 *
 * `order` fixes each milestone's place in a case's real lifecycle, so the
 * settings UI/schema can reject a policy whose end event can never actually
 * follow its start event (e.g. "payment confirmed" -> "case created").
 */
export const SLA_EVENT_POINTS = [
  { key: 'case_created', label: 'Case created', order: 0 },
  { key: 'assigned', label: 'Doctor assigned', order: 1 },
  { key: 'doctor_submitted', label: 'Doctor submits assessment', order: 2 },
  { key: 'hr_reviewed', label: 'HR completes review', order: 3 },
  { key: 'payment_confirmed', label: 'Doctor paid', order: 4 }
] as const;

export type SlaEventKey = (typeof SLA_EVENT_POINTS)[number]['key'];

export const SLA_EVENT_KEYS = SLA_EVENT_POINTS.map((point) => point.key) as [SlaEventKey, ...SlaEventKey[]];

const ORDER_BY_KEY = new Map(SLA_EVENT_POINTS.map((point) => [point.key, point.order]));

/** Whether `endEvent` can ever chronologically follow `startEvent` in a case's real lifecycle — the settings form and schema both use this to keep an admin from defining a policy that could never resolve. */
export function isValidEventOrder(startEvent: string, endEvent: string): boolean {
  const startOrder = ORDER_BY_KEY.get(startEvent as SlaEventKey);
  const endOrder = ORDER_BY_KEY.get(endEvent as SlaEventKey);
  return startOrder !== undefined && endOrder !== undefined && endOrder > startOrder;
}

export function slaEventLabel(key: string): string {
  return SLA_EVENT_POINTS.find((point) => point.key === key)?.label ?? key;
}
