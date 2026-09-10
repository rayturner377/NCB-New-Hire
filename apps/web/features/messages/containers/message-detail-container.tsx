import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, canViewMessageCentre, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { MessageDetail } from '../components/message-detail';
import { getMessageDetail } from '../services/messages-service';

export interface MessageDetailContainerProps {
  messageId: string;
}

export async function MessageDetailContainer({ messageId }: MessageDetailContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!canViewMessageCentre(session.user)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.NOTIFICATIONS_VIEW,
      path: '/messages',
      entityId: messageId
    });
    redirect('/');
  }

  const message = await getMessageDetail(messageId);
  if (!message) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Message not found.</p>
      </div>
    );
  }

  // Resending is a mutation, not a view — gated on NOTIFICATIONS_MANAGE specifically (same
  // permission resend-message.ts itself enforces) so a view-only auditor never sees a "Resend"
  // button that would just be rejected server-side if clicked.
  const canResend = hasPermission(session.user, PERMISSIONS.NOTIFICATIONS_MANAGE);

  return (
    <div className="flex flex-col gap-4 p-6">
      <MessageDetail message={message} canResend={canResend} />
    </div>
  );
}
