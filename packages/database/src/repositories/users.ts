import type { AppUser, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewUserInput {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordRecord: unknown;
  medicalProfile?: unknown;
}

export interface UserPatch {
  displayName?: string;
  role?: string;
  active?: boolean;
  passwordRecord?: unknown;
  medicalProfile?: unknown;
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
          medicalProfile: (input.medicalProfile ?? {}) as any
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
          ...(patch.medicalProfile !== undefined && { medicalProfile: patch.medicalProfile as any })
        }
      });
    },

    setActive(id: string, active: boolean): Promise<AppUser> {
      return db.appUser.update({ where: { id }, data: { active } });
    }
  };
}

export const usersRepository = createUsersRepository(prisma);
