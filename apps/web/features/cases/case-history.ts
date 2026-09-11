import type { AuditEvent } from '@ncb/database';
import { EVENT_LABELS } from '../../lib/audit-event-labels';
import { roleLabel } from '../../lib/role-labels';
import { statusLabel } from '../../lib/status-labels';

export interface CaseHistoryUser {
  displayName: string;
  role: string;
}

export interface CaseHistoryEntry {
  id: string;
  occurredAt: string;
  eventLabel: string;
  from: string;
  to: string;
  actorName: string;
  actorRole: string;
}

/**
 * Turns the raw audit_events rows for one case (cases-service.ts's
 * listCaseAuditEvents) into a structured "who did what, when" table for the
 * case workspace's History tab — separate From/To/Event columns rather than
 * one baked-in sentence, so the table can be scanned at a glance instead of
 * read line by line.
 */
export function formatCaseHistory(events: AuditEvent[], usersById: Map<string, CaseHistoryUser>): CaseHistoryEntry[] {
  return events.map((event) => {
    const actor = event.actorUserId ? usersById.get(event.actorUserId) : undefined;
    const actorName = event.actorUserId ? actor?.displayName ?? 'Unknown user' : 'System';
    const actorRole = event.actorUserId ? (actor ? roleLabel(actor.role) : '—') : '—';
    const details = (event.details as Record<string, unknown>) ?? {};

    let from = '—';
    let to = '—';
    if (event.eventType === 'case_transition') {
      from = details.from ? statusLabel(String(details.from)) : 'the start';
      to = statusLabel(String(details.to));
    } else if (event.eventType === 'case_reassigned') {
      from = details.from ? usersById.get(String(details.from))?.displayName ?? 'a previous doctor' : 'Unassigned';
      to = usersById.get(String(details.to))?.displayName ?? 'Unknown doctor';
    } else if (event.eventType === 'case_payment_confirmed') {
      from = 'Unpaid';
      to = details.paidOn ? `Paid (${String(details.paidOn)})` : 'Paid';
    }

    return {
      id: String(event.id),
      occurredAt: event.occurredAt.toISOString(),
      eventLabel: EVENT_LABELS[event.eventType] ?? event.eventType,
      from,
      to,
      actorName,
      actorRole
    };
  });
}
