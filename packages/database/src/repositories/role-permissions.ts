import type { PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

/** Admin-editable role -> permission grants (Settings -> Permissions) — never holds 'admin' rows; see schema.prisma's RolePermission doc comment. */
export function createRolePermissionsRepository(db: PrismaClient) {
  return {
    listAll(): Promise<{ role: string; permission: string }[]> {
      return db.rolePermission.findMany();
    },

    /** Atomic replace of one role's whole permission set — the admin UI always submits the complete checked list for a role, not incremental add/remove. */
    async setForRole(role: string, permissions: string[]): Promise<void> {
      await db.$transaction([
        db.rolePermission.deleteMany({ where: { role } }),
        db.rolePermission.createMany({ data: permissions.map((permission) => ({ role, permission })) })
      ]);
    }
  };
}

export const rolePermissionsRepository = createRolePermissionsRepository(prisma);
