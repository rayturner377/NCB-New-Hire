import { rolePermissionsRepository } from '@ncb/database';
import { redis } from '@ncb/redis';
import { PERMISSIONS, ROLES, type Permission } from './permissions';

/** A shared Redis counter, bumped on every invalidation — lets every process notice a Settings -> Permissions edit made by another one (see invalidateRolePermissionsCache's own doc comment). */
const VERSION_KEY = 'role-permissions:version';

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
 * edit here can ever lock every admin out. The Map itself is still per-process (each instance
 * holds its own copy), but every process checks the shared VERSION_KEY counter before trusting its
 * copy — a single instance's cache used to be the only one that noticed its own invalidation,
 * leaving every other instance in a multi-instance deployment serving stale permissions until
 * restart.
 */
let rolePermissionsCache: Map<string, Permission[]> | null = null;
let cachedVersion: string | null = null;

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

/** Call after any Settings -> Permissions edit — bumps the shared Redis counter so every process (not just the one that made the edit) reloads on its next read, instead of only the calling process's own in-memory cache noticing. */
export async function invalidateRolePermissionsCache(): Promise<void> {
  rolePermissionsCache = null;
  cachedVersion = null;
  await redis.incr(VERSION_KEY);
}

async function getDbRolePermissions(role: string): Promise<Permission[]> {
  const currentVersion = await redis.get(VERSION_KEY);
  if (!rolePermissionsCache || currentVersion !== cachedVersion) {
    rolePermissionsCache = await loadRolePermissionsCache();
    cachedVersion = currentVersion;
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
