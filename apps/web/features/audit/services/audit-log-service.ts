import { auditRepository } from '@ncb/database';
import { eventLabel } from '../../../lib/audit-event-labels';
import { roleLabel } from '../../../lib/role-labels';
import { LIST_PATH_BY_ROLE } from '../../../lib/role-list-paths';
import { statusLabel } from '../../../lib/status-labels';
import { listCasesWithPatient } from '../../cases/services/cases-service';
import { listUsers } from '../../users/services/users-service';

export interface AuditLogFilters {
  eventTypes?: string[];
  entityType?: string;
  from?: string;
  to?: string;
}

export interface AuditLogRow {
  id: string;
  occurredAt: string;
  action: string;
  actorName: string;
  actorRole: string;
  entityKind: string;
  entityLabel: string;
  href: string | null;
  detail: string;
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  total: number;
}

/**
 * Same "join actor/patient names onto raw audit_events rows" pattern as
 * case-history.ts's formatCaseHistory and reviewer-dashboard-service.ts's
 * recentUpdates, generalized to any event type for the full /audit log.
 * Decrypts every case's payload up front (listCasesWithPatient), same
 * accepted cost the org billing report and dashboard already pay, so a
 * case-related row can show the patient's name rather than a bare case id.
 */
export async function getAuditLog(filters: AuditLogFilters, page: number, pageSize: number): Promise<AuditLogPage> {
  const [{ rows, total }, allUsers, cases] = await Promise.all([
    auditRepository.query(
      {
        eventTypes: filters.eventTypes,
        entityType: filters.entityType,
        from: filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined,
        to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined
      },
      page,
      pageSize
    ),
    listUsers(),
    listCasesWithPatient()
  ]);

  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  const casesById = new Map(cases.map((item) => [item.id, item]));

  const formatted: AuditLogRow[] = rows.map((event) => {
    const actor = event.actorUserId ? usersById.get(event.actorUserId) : undefined;
    const actorName = event.actorUserId ? actor?.displayName ?? 'Unknown user' : 'System';
    const actorRole = event.actorUserId ? roleLabel(actor?.role ?? '') : '—';
    const details = (event.details as Record<string, unknown>) ?? {};
    const action = eventLabel(event.eventType);

    if (event.entityType === 'case' && event.entityId) {
      const relatedCase = casesById.get(event.entityId);
      let detail = '';
      if (event.eventType === 'case_transition') {
        detail = `${details.from ? statusLabel(String(details.from)) : 'the start'} → ${statusLabel(String(details.to))}`;
      } else if (event.eventType === 'case_reassigned') {
        const from = details.from ? usersById.get(String(details.from))?.displayName ?? 'a previous doctor' : 'Unassigned';
        const to = usersById.get(String(details.to))?.displayName ?? 'Unknown doctor';
        detail = `${from} → ${to}`;
      } else if (event.eventType === 'case_payment_confirmed') {
        detail = details.paidOn ? `Paid on ${String(details.paidOn)}` : 'Paid';
      }
      return {
        id: String(event.id),
        occurredAt: event.occurredAt.toISOString(),
        action,
        actorName,
        actorRole,
        entityKind: 'Patient case',
        entityLabel: relatedCase?.patient.fullName ?? 'Deleted case',
        href: relatedCase ? `/cases/${relatedCase.id}` : null,
        detail
      };
    }

    if (event.entityType === 'user' && event.entityId) {
      const targetUser = usersById.get(event.entityId);
      const role = targetUser?.role ?? String(details.role ?? '');
      const displayName = targetUser?.displayName ?? String(details.displayName ?? 'Unknown user');
      return {
        id: String(event.id),
        occurredAt: event.occurredAt.toISOString(),
        action,
        actorName,
        actorRole,
        entityKind: 'User account',
        entityLabel: displayName,
        href: targetUser ? LIST_PATH_BY_ROLE[targetUser.role] ?? '/users' : null,
        detail: role ? roleLabel(role) : ''
      };
    }

    if (event.entityType === 'settings') {
      return {
        id: String(event.id),
        occurredAt: event.occurredAt.toISOString(),
        action,
        actorName,
        actorRole,
        entityKind: 'System settings',
        entityLabel: event.entityId ?? 'Settings',
        href: '/settings',
        detail: ''
      };
    }

    if (event.entityType === 'route' && event.entityId) {
      return {
        id: String(event.id),
        occurredAt: event.occurredAt.toISOString(),
        action,
        actorName,
        actorRole,
        entityKind: 'Route',
        entityLabel: event.entityId,
        href: null,
        detail: details.permission ? String(details.permission) : ''
      };
    }

    return {
      id: String(event.id),
      occurredAt: event.occurredAt.toISOString(),
      action,
      actorName,
      actorRole,
      entityKind: '—',
      entityLabel: '—',
      href: null,
      detail: ''
    };
  });

  return { rows: formatted, total };
}
