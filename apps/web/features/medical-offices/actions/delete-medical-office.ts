'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { deleteMedicalOffice } from '../services/medical-offices-service';

/** Same permission create/update-medical-office.ts require. Soft delete — see medicalOfficesRepository.softDelete — so a doctor account still referencing this facility in its own medicalProfile snapshot (facilityName/facilityAddress, taken at the time they were assigned) doesn't break; it just can't be picked for a new assignment anymore. */
export async function deleteMedicalOfficeAction(formData: FormData): Promise<void> {
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
  if (!officeId) return;

  await deleteMedicalOffice(officeId, session.user.id);
  revalidatePath('/doctors');
  redirect('/doctors?tab=offices');
}
