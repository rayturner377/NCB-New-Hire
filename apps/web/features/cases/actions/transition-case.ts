'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { caseStatusSchema } from '../schemas/case';
import { transitionCase } from '../services/cases-service';

/**
 * Generic no-JS-required transition action — every status-change button
 * (submit, cancel, review, archive) posts to this with the case's current
 * version and the desired new status as hidden fields, relying on the
 * Postgres transition_medical_case stored procedure for optimistic
 * concurrency (a stale version throws rather than silently overwriting).
 */
export async function transitionCaseAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) return;

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_UPDATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const expectedVersion = Number.parseInt(String(formData.get('version') || ''), 10);
  const statusResult = caseStatusSchema.safeParse(formData.get('newStatus'));

  if (!caseId || !Number.isFinite(expectedVersion) || !statusResult.success) return;

  await transitionCase(caseId, expectedVersion, statusResult.data, session.user.id);
  revalidatePath('/cases');
}
