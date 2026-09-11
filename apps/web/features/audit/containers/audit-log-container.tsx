import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getAuditLog } from '../services/audit-log-service';
import { AuditLog } from '../components/audit-log';

export interface AuditLogContainerProps {
  searchParams?: { type?: string; from?: string; to?: string; page?: string };
}

const PAGE_SIZE = 25;

/** The full audit trail at /audit — admin/reviewer/auditor only (PERMISSIONS.AUDIT_LOG_VIEW), reached from the dashboard's Recent updates panel. */
export async function AuditLogContainer({ searchParams = {} }: AuditLogContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.AUDIT_LOG_VIEW)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.AUDIT_LOG_VIEW,
      path: '/audit'
    });
    redirect('/');
  }

  const eventTypes = (searchParams.type ?? '').split(',').filter(Boolean);
  const from = searchParams.from ?? '';
  const to = searchParams.to ?? '';
  const hasActiveFilters = Boolean(eventTypes.length || from || to);
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { rows, total } = await getAuditLog({ eventTypes: eventTypes.length ? eventTypes : undefined, from, to }, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  function hrefForPage(targetPage: number): string {
    const params = new URLSearchParams();
    if (eventTypes.length) params.set('type', eventTypes.join(','));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (targetPage > 1) params.set('page', String(targetPage));
    const search = params.toString();
    return search ? `/audit?${search}` : '/audit';
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AuditLog
        rows={rows}
        filters={{ eventTypes, from, to }}
        hasActiveFilters={hasActiveFilters}
        total={total}
        pagination={{ page: currentPage, totalPages, hrefForPage }}
      />
    </div>
  );
}
