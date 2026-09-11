import { rolePermissionsRepository } from '@ncb/database';
import { PERMISSIONS, ROLES, type Permission } from './permissions';

/**
 * Server-only — deliberately kept out of lib/permissions.ts, which nav-config.ts (client
 * components: sidebar.tsx/app-shell.tsx) imports for its pure ROLES/Permission constants. Pulling
 * in @ncb/database here — even via a dynamic import — makes a bundler try to include the
 * Prisma-generated client (Node-only, uses `fs`) in the browser bundle. Only lib/session.ts and
 * the Settings -> Permissions actions should ever import this file.
 *
 * In-memory cache of the DB-backed, admin-editable role_permissions table — that table is small
 * (roughly one row per role/permission pair) and changes only through Settings -> Permissions, so
 * holding the whole thing in memory and refreshing on write avoids a database round trip on every
 * single permission check across the app. Deliberately excludes 'admin': that role's set is always
 * Object.values(PERMISSIONS) in code (see getEffectivePermissions), never read from the DB, so no
 * edit here can ever lock every admin out. Per-process only, same documented tradeoff as
 * action-rate-limit.ts's in-memory limiter — fine for this app's current single-instance
 * deployment, would need a shared store (Redis, etc.) before running more than one instance.
 */
let rolePermissionsCache: Map<string, Permission[]> | null = null;

async function loadRolePermissionsCache(): Promise<Map<string, Permission[]>> {
  const rows = await rolePermissionsRepository.listAll();
  const cache = new Map<string, Permission[]>();
  for (const row of rows) {
    const list = cache.get(row.role) ?? [];
    list.push(row.permission as Permission);
    cache.set(row.role, list);
  }
  return cache;
}

/** Call after any Settings -> Permissions edit so already-populated caches don't serve stale data until the next process restart. */
export function invalidateRolePermissionsCache(): void {
  rolePermissionsCache = null;
}

async function getDbRolePermissions(role: string): Promise<Permission[]> {
  if (!rolePermissionsCache) {
    rolePermissionsCache = await loadRolePermissionsCache();
  }
  return rolePermissionsCache.get(role) ?? [];
}

interface PermissionOverrides {
  grant?: string[];
  revoke?: string[];
}

/**
 * The one place effective permissions get computed — called from lib/session.ts's getSession() so
 * every request's session.user already carries the resolved `permissions` array by the time any
 * hasPermission()/requirePermission() call happens; those stay fully synchronous, with zero DB
 * access of their own, because this already ran. 'admin' is hardcoded to every permission that
 * exists and never consults the DB or overrides at all — the one role that can't be edited into
 * losing access to the system that controls access. Revoke always wins over grant.
 */
export async function getEffectivePermissions(user: { role: string; permissionOverrides?: unknown }): Promise<Permission[]> {
  if (user.role === ROLES.ADMIN) {
    return Object.values(PERMISSIONS);
  }

  const rolePermissions = await getDbRolePermissions(user.role);
  const overrides = (user.permissionOverrides ?? {}) as PermissionOverrides;
  const grant = new Set(overrides.grant ?? []);
  const revoke = new Set(overrides.revoke ?? []);

  const effective = new Set(rolePermissions);
  for (const permission of grant) effective.add(permission as Permission);
  for (const permission of revoke) effective.delete(permission as Permission);

  return [...effective];
}
