import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, canViewMessageCentre, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { findNotificationTemplateDefinition } from '../../notifications/registry';
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
  // button that would just be rejected server-side if clicked. Also never offered for a
  // secret-bearing template (password reset/activation/device verification) — the stored body is
  // already redacted, and resendEmailMessage itself refuses these regardless of this check; hiding
  // the button here just avoids a pointless click-then-error.
  const definition = message.templateKey ? findNotificationTemplateDefinition(message.templateKey) : undefined;
  const canResend = hasPermission(session.user, PERMISSIONS.NOTIFICATIONS_MANAGE) && !definition?.secretVariableNames?.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <MessageDetail message={message} canResend={canResend} />
    </div>
  );
}
