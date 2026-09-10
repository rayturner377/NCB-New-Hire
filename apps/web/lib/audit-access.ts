import { auditRepository } from '@ncb/database';
import { getClientIp } from './client-ip';
import type { Permission } from './permissions';

/**
 * Records a denied access attempt to the tamper-evident audit chain
 * (packages/database's audit_events hash chain — see auditRepository.append)
 * — until now this app only ever audited login success/failure, nothing
 * about authorization denials past that point. Call this from a container's
 * permission-guard `redirect()` branch, not from the redirect itself, so the
 * event is recorded before the response leaves.
 */
export async function logAccessDenied(input: {
  userId: string;
  role: string;
  permission: Permission;
  path: string;
  entityId?: string;
}): Promise<void> {
  const ip = await getClientIp();
  await auditRepository.append({
    eventType: 'access_denied',
    actorUserId: input.userId,
    entityType: 'route',
    entityId: input.entityId ?? input.path,
    sourceIp: ip,
    details: { role: input.role, permission: input.permission, path: input.path }
  });
}
