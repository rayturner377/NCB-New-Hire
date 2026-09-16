'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { setMedicalOfficeActive } from '../services/medical-offices-service';

/** Same permission create/update-medical-office.ts require — see update-medical-office.ts's own comment on why there's no separate MEDICAL_OFFICES_UPDATE permission. Deactivating (not deleting) is the safe default for "this facility isn't in use anymore" — it drops out of the doctor-creation facility picker (listActiveMedicalOfficeOptions) without touching any doctor/case that already references it. */
export async function setMedicalOfficeActiveAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) return;

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  const officeId = String(formData.get('officeId') || '');
  const active = String(formData.get('active') || '') === 'true';
  if (!officeId) return;

  await setMedicalOfficeActive(officeId, active, session.user.id);
  revalidatePath('/doctors');
  revalidatePath(`/medical-offices/${officeId}`);
}
