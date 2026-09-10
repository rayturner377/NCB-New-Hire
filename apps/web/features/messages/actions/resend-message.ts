'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { resendEmailMessage } from '../../notifications/services/notification-service';

export interface ResendMessageResult {
  ok: boolean;
  error?: string;
}

/** 20 per 15 minutes per admin — generous for genuinely retrying a batch of failed sends, still bounded. */
const resendLimiter = createActionRateLimiter(20, 15 * 60 * 1000);

/** Re-attempts a past send exactly as it was originally rendered — see notification-service.ts's resendEmailMessage. */
export async function resendMessageAction(_prevState: ResendMessageResult | null, formData: FormData): Promise<ResendMessageResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.NOTIFICATIONS_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (resendLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many resend attempts — please wait a few minutes and try again.' };
  }
  resendLimiter.recordAttempt(session.user.id);

  const id = String(formData.get('id') || '');
  if (!id) {
    return { ok: false, error: 'Missing message reference.' };
  }

  try {
    await resendEmailMessage(id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to resend.' };
  }

  revalidatePath('/messages');
  revalidatePath(`/messages/${id}`);
  return { ok: true };
}
