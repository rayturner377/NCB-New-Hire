'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { createCaseSchema } from '../schemas/case';
import { createCase } from '../services/cases-service';

export interface CaseActionResult {
  ok: boolean;
  error?: string;
}

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

  const parsed = createCaseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid case details.' };
  }

  await createCase({ ...parsed.data, createdBy: session.user.id });

  revalidatePath('/cases');
  return { ok: true };
}
