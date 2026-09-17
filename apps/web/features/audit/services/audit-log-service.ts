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

type AuditEvent = Awaited<ReturnType<typeof auditRepository.query>>['rows'][number];

/** Only what resolveAuditActor/resolveAuditEntity actually read off a user — not the full UserSummary (email, medicalProfile, active, ...) listUsers() returns. */
interface AuditActorSummary {
  displayName: string;
  role: string;
}

/** Only what resolveAuditEntity actually reads off a case — not the full decrypted CaseWithPatient<CasePayload> listCasesWithPatient() returns. */
interface AuditCaseSummary {
  id: string;
  patient: { fullName: string };
}

type UsersById = Map<string, AuditActorSummary>;
type CasesById = Map<string, AuditCaseSummary>;

/** "System" for an unattributed event (e.g. a scheduled job), otherwise the actor's own name/role — same fallback case-history.ts's formatCaseHistory uses. */
function resolveAuditActor(event: AuditEvent, usersById: UsersById): { actorName: string; actorRole: string } {
  if (!event.actorUserId) {
    return { actorName: 'System', actorRole: '—' };
  }
  const actor = usersById.get(event.actorUserId);
  return { actorName: actor?.displayName ?? 'Unknown user', actorRole: roleLabel(actor?.role ?? '') };
}

/** The one-line "what changed" detail for a case-entity event — only a few event types have anything worth summarizing here; everything else is blank. */
function describeCaseAuditEvent(event: AuditEvent, details: Record<string, unknown>, usersById: UsersById): string {
  if (event.eventType === 'case_transition') {
    return `${details.from ? statusLabel(String(details.from)) : 'the start'} → ${statusLabel(String(details.to))}`;
  }
  if (event.eventType === 'case_reassigned') {
    const from = details.from ? usersById.get(String(details.from))?.displayName ?? 'a previous doctor' : 'Unassigned';
    const to = usersById.get(String(details.to))?.displayName ?? 'Unknown doctor';
    return `${from} → ${to}`;
  }
  if (event.eventType === 'case_payment_confirmed') {
    return details.paidOn ? `Paid on ${String(details.paidOn)}` : 'Paid';
  }
  return '';
}

/** The entity-specific columns (kind/label/link/detail) — one branch per entityType audit_events actually records; entityType/entityId with no matching branch fall through to the generic "—" row below. */
function resolveAuditEntity(
  event: AuditEvent,
  details: Record<string, unknown>,
  usersById: UsersById,
  casesById: CasesById
): Pick<AuditLogRow, 'entityKind' | 'entityLabel' | 'href' | 'detail'> {
  if (event.entityType === 'case' && event.entityId) {
    const relatedCase = casesById.get(event.entityId);
    return {
      entityKind: 'Patient case',
      entityLabel: relatedCase?.patient.fullName ?? 'Deleted case',
      href: relatedCase ? `/cases/${relatedCase.id}` : null,
      detail: describeCaseAuditEvent(event, details, usersById)
    };
  }

  if (event.entityType === 'user' && event.entityId) {
    const targetUser = usersById.get(event.entityId);
    const role = targetUser?.role ?? String(details.role ?? '');
    const displayName = targetUser?.displayName ?? String(details.displayName ?? 'Unknown user');
    return {
      entityKind: 'User account',
      entityLabel: displayName,
      href: targetUser ? LIST_PATH_BY_ROLE[targetUser.role] ?? '/users' : null,
      detail: role ? roleLabel(role) : ''
    };
  }

  if (event.entityType === 'settings') {
    return { entityKind: 'System settings', entityLabel: event.entityId ?? 'Settings', href: '/settings', detail: '' };
  }

  if (event.entityType === 'route' && event.entityId) {
    return { entityKind: 'Route', entityLabel: event.entityId, href: null, detail: details.permission ? String(details.permission) : '' };
  }

  return { entityKind: '—', entityLabel: '—', href: null, detail: '' };
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

  const usersById: UsersById = new Map(allUsers.map((user) => [user.id, user]));
  const casesById: CasesById = new Map(cases.map((item) => [item.id, item]));

  const formatted: AuditLogRow[] = rows.map((event) => {
    const details = (event.details as Record<string, unknown>) ?? {};

    return {
      id: String(event.id),
      occurredAt: event.occurredAt.toISOString(),
      action: eventLabel(event.eventType),
      ...resolveAuditActor(event, usersById),
      ...resolveAuditEntity(event, details, usersById, casesById)
    };
  });

  return { rows: formatted, total };
}
