'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { createCaseSchema } from '../schemas/case';
import { createCase } from '../services/cases-service';

export interface CaseActionResult {
  ok: boolean;
  error?: string;
  caseId?: string;
}

/** 30 per 10 minutes per user — generous for HR working through a real batch of new hires, still bounds runaway/scripted case creation. */
const createCaseLimiter = createActionRateLimiter(30, 10 * 60 * 1000);

/** On success this returns the new case's id rather than redirecting, so the form can show a confirmation modal before navigating there. */
export async function createCaseAction(
  _prevState: CaseActionResult | null,
  formData: FormData
): Promise<CaseActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (createCaseLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many cases created recently — please wait a few minutes and try again.' };
  }
  createCaseLimiter.recordAttempt(session.user.id);

  const parsed = createCaseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid case details.' };
  }

  const created = await createCase({ ...parsed.data, createdBy: session.user.id });

  revalidatePath('/cases');
  return { ok: true, caseId: created.id };
}
