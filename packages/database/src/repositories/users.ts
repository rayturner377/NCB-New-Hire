import type { AppUser, Prisma, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';
import type { PaginatedResult } from '../pagination.js';

export interface UserSearchFilters {
  role?: string;
  /** Matched against displayName OR email, case-insensitive, substring. */
  query?: string;
}

export function buildUserSearchWhere(filters: UserSearchFilters): Prisma.AppUserWhereInput {
  const and: Prisma.AppUserWhereInput[] = [{ deletedAt: null }];
  if (filters.role) {
    and.push({ role: filters.role });
  }
  if (filters.query) {
    and.push({
      OR: [
        { displayName: { contains: filters.query, mode: 'insensitive' } },
        { email: { contains: filters.query, mode: 'insensitive' } }
      ]
    });
  }
  return { AND: and };
}

export interface NewUserInput {
  id: string;
  email: string;
  displayName: string;
  role: string;
  medicalProfile?: unknown;
  /** Forces the change-password wizard on next login — defaults to false (matches existing rows) when omitted. */
  mustChangePassword?: boolean;
  /** Only meaningful for role === 'delegate' — the one doctor this assistant acts on behalf of. */
  delegateForClinicianId?: string | null;
}

export interface UserPatch {
  displayName?: string;
  role?: string;
  active?: boolean;
  medicalProfile?: unknown;
  mustChangePassword?: boolean;
  /** `{ grant: string[], revoke: string[] }` — see lib/permissions.ts's getEffectivePermissions. */
  permissionOverrides?: unknown;
  /** Reassigning a delegate to a different doctor, or unlinking (null) — see NewUserInput's own doc comment. */
  delegateForClinicianId?: string | null;
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

    /** The paginated, filtered equivalent of listUsers — a role-scoped or searched list page uses this instead of fetching every account in the system and filtering in JS. */
    async search(filters: UserSearchFilters, page: number, pageSize: number): Promise<PaginatedResult<AppUser>> {
      const where = buildUserSearchWhere(filters);
      const [rows, total] = await Promise.all([
        db.appUser.findMany({
          where,
          // `id` breaks ties between rows with the identical displayName — without it, Postgres
          // doesn't guarantee the same relative order across separate paginated queries, which can
          // show a row twice or skip one entirely across a page boundary.
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        db.appUser.count({ where })
      ]);
      return { rows, total };
    },

    /** Total/active counts for one role — the stat cards atop a role's list page need these regardless of which page of results is currently showing, so they're their own lightweight count query rather than derived from a fetched array. */
    async countByRole(role: string): Promise<{ total: number; active: number }> {
      const [total, active] = await Promise.all([
        db.appUser.count({ where: { role, deletedAt: null } }),
        db.appUser.count({ where: { role, deletedAt: null, active: true } })
      ]);
      return { total, active };
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
          medicalProfile: (input.medicalProfile ?? {}) as any,
          mustChangePassword: input.mustChangePassword ?? false,
          delegateForClinicianId: input.delegateForClinicianId ?? null
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
          ...(patch.medicalProfile !== undefined && { medicalProfile: patch.medicalProfile as any }),
          ...(patch.mustChangePassword !== undefined && { mustChangePassword: patch.mustChangePassword }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(patch.permissionOverrides !== undefined && { permissionOverrides: patch.permissionOverrides as any }),
          ...(patch.delegateForClinicianId !== undefined && { delegateForClinicianId: patch.delegateForClinicianId })
        }
      });
    },

    setActive(id: string, active: boolean): Promise<AppUser> {
      return db.appUser.update({ where: { id }, data: { active } });
    },

    /** Soft delete — sets `deletedAt` rather than removing the row, so audit history and any still-referencing records (cases created_by, etc.) stay intact. */
    softDelete(id: string): Promise<AppUser> {
      return db.appUser.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    },

    /**
     * The Settings → User Policy "require device verification" break-glass toggle — bulk-flips every
     * non-deleted account's twoFactorEnabled to match, since that column (not a settings row) is what
     * Better Auth's `two-factor` plugin actually checks on sign-in (see packages/auth/src/index.ts).
     */
    setTwoFactorEnabledForAll(enabled: boolean): Promise<{ count: number }> {
      return db.appUser.updateMany({ where: { deletedAt: null }, data: { twoFactorEnabled: enabled } });
    }
  };
}

export const usersRepository = createUsersRepository(prisma);
