import type { AppUser, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewUserInput {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordRecord: unknown;
  medicalProfile?: unknown;
  /** Forces the change-password wizard on next login — defaults to false (matches existing rows) when omitted. */
  mustChangePassword?: boolean;
}

export interface UserPatch {
  displayName?: string;
  role?: string;
  active?: boolean;
  passwordRecord?: unknown;
  medicalProfile?: unknown;
  mustChangePassword?: boolean;
  /** `{ grant: string[], revoke: string[] }` — see lib/permissions.ts's getEffectivePermissions. */
  permissionOverrides?: unknown;
}

/**
 * Postgres row-level atomicity on `update` replaces the old file-based
 * `mutateUsers` in-process mutation queue (server.js ~L4656) — each update is
 * already a single atomic statement, no application-level serialization needed.
 */
export function createUsersRepository(db: PrismaClient) {
  return {
    listUsers(): Promise<AppUser[]> {
      return db.appUser.findMany({ where: { deletedAt: null } });
    },

    findByEmail(email: string): Promise<AppUser | null> {
      return db.appUser.findFirst({ where: { email, deletedAt: null } });
    },

    findById(id: string): Promise<AppUser | null> {
      return db.appUser.findFirst({ where: { id, deletedAt: null } });
    },

    create(input: NewUserInput): Promise<AppUser> {
      return db.appUser.create({
        data: {
          id: input.id,
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          passwordRecord: input.passwordRecord as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          medicalProfile: (input.medicalProfile ?? {}) as any,
          mustChangePassword: input.mustChangePassword ?? false
        }
      });
    },

    update(id: string, patch: UserPatch): Promise<AppUser> {
      return db.appUser.update({
        where: { id },
        data: {
          ...(patch.displayName !== undefined && { displayName: patch.displayName }),
          ...(patch.role !== undefined && { role: patch.role }),
          ...(patch.active !== undefined && { active: patch.active }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(patch.passwordRecord !== undefined && { passwordRecord: patch.passwordRecord as any }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(patch.medicalProfile !== undefined && { medicalProfile: patch.medicalProfile as any }),
          ...(patch.mustChangePassword !== undefined && { mustChangePassword: patch.mustChangePassword }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(patch.permissionOverrides !== undefined && { permissionOverrides: patch.permissionOverrides as any })
        }
      });
    },

    setActive(id: string, active: boolean): Promise<AppUser> {
      return db.appUser.update({ where: { id }, data: { active } });
    },

    /** Soft delete — sets `deletedAt` rather than removing the row, so audit history and any still-referencing records (cases created_by, etc.) stay intact. */
    softDelete(id: string): Promise<AppUser> {
      return db.appUser.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    }
  };
}

export const usersRepository = createUsersRepository(prisma);
