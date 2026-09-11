import { CheckCircle2, Mail, XCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Pagination } from '../../../components/dashboard/pagination';
import { RouteTabs } from '../../../components/dashboard/route-tabs';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatCard } from '../../../components/dashboard/stat-card';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, canViewMessageCentre } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { MessageList } from '../components/message-list';
import { MessagesSearch } from '../components/messages-search';
import { getMessageCounts, listMessages } from '../services/messages-service';

export interface MessagesContainerProps {
  searchParams?: { folder?: string; query?: string; page?: string };
}

const PAGE_SIZE = 25;
const FOLDER_LABELS: Record<string, string> = { all: 'All messages', sent: 'Sent', failed: 'Failed' };

/** The Message Centre — every notification email the system has attempted, viewable by admin/reviewer/auditor (canViewMessageCentre — NOTIFICATIONS_MANAGE or the auditor-held NOTIFICATIONS_VIEW). Folders (All/Sent/Failed) are routes rather than client state, same reasoning as cases-container.tsx's Review queue/All cases tabs — each one only ever queries its own filtered slice. */
export async function MessagesContainer({ searchParams = {} }: MessagesContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!canViewMessageCentre(session.user)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.NOTIFICATIONS_VIEW,
      path: '/messages'
    });
    redirect('/');
  }

  const folder = searchParams.folder === 'sent' || searchParams.folder === 'failed' ? searchParams.folder : 'all';
  const query = searchParams.query?.trim() ?? '';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = folder === 'all' ? undefined : folder;

  const [counts, { rows, total }] = await Promise.all([getMessageCounts(), listMessages({ status, query }, page, PAGE_SIZE)]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  function hrefForPage(targetPage: number): string {
    const params = new URLSearchParams();
    if (folder !== 'all') params.set('folder', folder);
    if (query) params.set('query', query);
    if (targetPage > 1) params.set('page', String(targetPage));
    const search = params.toString();
    return search ? `/messages?${search}` : '/messages';
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Message Centre</h1>
        <p className="text-sm text-muted-foreground">Every notification email the system has attempted to send, and who it went to.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total messages" value={counts.total} icon={Mail} href="/messages" />
        <StatCard label="Sent" value={counts.sent} icon={CheckCircle2} href="/messages?folder=sent" />
        <StatCard label="Failed" value={counts.failed} icon={XCircle} href="/messages?folder=failed" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RouteTabs
            activeKey={folder}
            tabs={[
              { key: 'all', label: `All (${counts.total})`, href: '/messages' },
              { key: 'sent', label: `Sent (${counts.sent})`, href: '/messages?folder=sent' },
              { key: 'failed', label: `Failed (${counts.failed})`, href: '/messages?folder=failed' }
            ]}
          />
          <MessagesSearch query={query} folder={folder} />
        </div>

        <SectionCard title={FOLDER_LABELS[folder] ?? 'All messages'} description={`${total} message${total === 1 ? '' : 's'}`}>
          <div className="flex flex-col gap-4">
            <MessageList rows={rows} />
            <Pagination page={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
