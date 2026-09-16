'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { PERMISSIONS, ROLES } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { listDelegatesForClinician, updateUser } from '../services/users-service';

/**
 * A doctor's own narrow permission authority over their delegate(s) — the
 * one thing they can toggle for a delegate's access beyond activate/
 * deactivate (see set-user-active.ts's matching isOwnDelegate carve-out).
 * Deliberately hardcoded to exactly one permission rather than reusing
 * update-user-permission-overrides.ts's general grant/revoke-anything
 * mechanism (admin-only, ROLES_MANAGE-gated) — a doctor granting arbitrary
 * permissions to their delegate would be a real privilege-escalation path;
 * scoping this to MEDICAL_CASES_BILLING_VIEW specifically means there's
 * nothing else this action could ever be used to unlock.
 *
 * Authorization comes from fetching THIS doctor's own delegates
 * (listDelegatesForClinician) and requiring the target to already be in
 * that list, rather than a separate ownership check — a delegate linked to
 * a different doctor simply never appears in it.
 */
export async function toggleDelegateBillingViewAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session || session.user.role !== ROLES.DOCTOR) return;

  const delegateId = String(formData.get('delegateId') || '');
  const enabled = String(formData.get('enabled') || '') === 'true';
  if (!delegateId) return;

  const delegates = await listDelegatesForClinician(session.user.id);
  const delegate = delegates.find((candidate) => candidate.id === delegateId);
  if (!delegate) return;

  const grant = delegate.permissionOverrides.grant.filter((permission) => permission !== PERMISSIONS.MEDICAL_CASES_BILLING_VIEW);
  const revoke = delegate.permissionOverrides.revoke.filter((permission) => permission !== PERMISSIONS.MEDICAL_CASES_BILLING_VIEW);
  if (enabled) {
    grant.push(PERMISSIONS.MEDICAL_CASES_BILLING_VIEW);
  } else {
    revoke.push(PERMISSIONS.MEDICAL_CASES_BILLING_VIEW);
  }

  await updateUser(
    delegateId,
    { permissionOverrides: { grant, revoke } },
    session.user.id,
    {
      eventType: 'user_permission_overrides_updated',
      details: { grant: enabled ? [PERMISSIONS.MEDICAL_CASES_BILLING_VIEW] : [], revoke: enabled ? [] : [PERMISSIONS.MEDICAL_CASES_BILLING_VIEW] }
    }
  );

  revalidatePath('/delegates');
}
