import { randomUUID } from 'node:crypto';
import { auditRepository, usersRepository, type AppUser } from '@ncb/database';
import { setUserPassword, revokeAllSessionsForUser } from '@ncb/auth/utils';
import { sendNotification } from '../../notifications/services/notification-service';
import type { CreateUserSchemaInput, UpdateUserSchemaInput } from '../schemas/user';
import type { UserSummary } from '../types';

function toSummary(user: AppUser): UserSummary {
  const overrides = (user.permissionOverrides as { grant?: string[]; revoke?: string[] } | null) ?? {};
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    medicalProfile: (user.medicalProfile as Record<string, unknown>) ?? {},
    permissionOverrides: { grant: overrides.grant ?? [], revoke: overrides.revoke ?? [] }
  };
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with that email already exists.');
  }
}

/** Prisma's unique-constraint violation code — checked structurally rather than importing the Prisma error class, since this is the only thing about it this file cares about. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

export interface CreateUserInput extends CreateUserSchemaInput {
  /** Doctor-only fields (facility, registration number, rate) — see lib/medical-profile.ts's combineMedicalProfile. */
  medicalProfile?: Record<string, unknown>;
  /** Forces the change-password wizard on this account's next login — the admin's "require password change on first login" checkbox. */
  mustChangePassword?: boolean;
}

/**
 * Ported from server.js createUser/assertUniqueUserEmail (~L4629-4676). Email
 * uniqueness is checked here up front for a friendly error on the common
 * path, but the real guarantee is the database's own unique constraint
 * (schema.prisma's `@unique` on email) — two concurrent signups racing past
 * the findByEmail check would otherwise surface as a raw 500 from the
 * constraint violation, so that's caught below too and converted to the same
 * DuplicateEmailError.
 */
export async function createUser(input: CreateUserInput, actorId?: string): Promise<UserSummary> {
  const email = input.email.toLowerCase();
  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    throw new DuplicateEmailError();
  }

  let created: AppUser;
  try {
    created = await usersRepository.create({
      id: randomUUID(),
      email,
      displayName: input.displayName,
      role: input.role,
      medicalProfile: input.medicalProfile,
      mustChangePassword: input.mustChangePassword
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }

  // Creates the Better Auth credential Account row — without this, the new
  // user would have no way to actually sign in at all (Better Auth's
  // sign-in only ever checks the Account row, never AppUser directly).
  await setUserPassword(created.id, input.password);

  await auditRepository.append({
    eventType: 'user_created',
    actorUserId: actorId,
    entityType: 'user',
    entityId: created.id,
    details: { role: created.role, displayName: created.displayName }
  });

  await sendNotification({
    templateKey: 'account_created',
    to: created.email,
    variables: { recipientName: created.displayName, email: created.email, temporaryPassword: input.password, loginUrl: '/login' },
    entityType: 'user',
    entityId: created.id
  });

  return toSummary(created);
}

/** The target's current role, for an authorization check ahead of modifying their account (see requireCanManageUserAccount) — never trust a client-supplied role for this, only the database's own record of who they actually are right now. Null if no such (non-deleted) user exists. */
export async function getUserRole(id: string): Promise<string | null> {
  const user = await usersRepository.findById(id);
  return user?.role ?? null;
}

export async function listUsers(): Promise<UserSummary[]> {
  const users = await usersRepository.listUsers();
  return users.map(toSummary);
}

/** Active doctor accounts, for assigning a case directly to a clinician (medical-office rosters aren't wired up yet). */
export async function listActiveDoctors(): Promise<UserSummary[]> {
  const users = await usersRepository.listUsers();
  return users.filter((user) => user.role === 'clinician' && user.active).map(toSummary);
}

export async function setUserActive(id: string, active: boolean, actorId?: string): Promise<UserSummary> {
  const updated = await usersRepository.setActive(id, active);

  await auditRepository.append({
    eventType: active ? 'user_activated' : 'user_deactivated',
    actorUserId: actorId,
    entityType: 'user',
    entityId: id,
    details: { role: updated.role, displayName: updated.displayName }
  });

  return toSummary(updated);
}

export interface UpdateUserInput extends UpdateUserSchemaInput {
  medicalProfile?: Record<string, unknown>;
  permissionOverrides?: { grant: string[]; revoke: string[] };
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<UserSummary> {
  const updated = await usersRepository.update(id, patch);
  return toSummary(updated);
}

/** Soft delete — see usersRepository.softDelete. Captures displayName/role in the audit event's own details since a deleted user drops out of listUsers() (and so out of any later "who is this" lookup by id). */
export async function deleteUser(id: string, actorId?: string): Promise<void> {
  const deleted = await usersRepository.softDelete(id);

  await auditRepository.append({
    eventType: 'user_deleted',
    actorUserId: actorId,
    entityType: 'user',
    entityId: id,
    details: { role: deleted.role, displayName: deleted.displayName }
  });
}

/**
 * Sets a new password and clears the forced-change flag — the
 * change-password wizard's only job. Session revocation (killing every
 * *other* session on the account, keeping the caller's own alive) happens in
 * the caller (features/auth/actions/change-password.ts) via Better Auth's
 * auth.api.revokeOtherSessions(), which needs the request's own
 * headers/cookie to know which session is "current" — context this service
 * function doesn't have and shouldn't need.
 */
export async function changePassword(id: string, newPassword: string): Promise<void> {
  await usersRepository.update(id, { mustChangePassword: false });
  await setUserPassword(id, newPassword);
}

/**
 * Admin/HR setting a NEW temporary password on someone else's account — a
 * candidate who forgot theirs, or one that was typed wrong at creation.
 * Deliberately the opposite default of changePassword above: `mustChangePassword`
 * defaults to true, the same "share the temporary password with them
 * directly, they'll be asked to set their own on next login" pattern account
 * creation already uses, rather than silently leaving an admin-known password
 * in place. Also kills every existing session on the account, unconditionally
 * (there's no "caller's own session" to preserve here — the actor is HR/admin,
 * not the account owner) — the same reasoning as changePassword above: if
 * this reset is happening because the account was compromised, whatever
 * session an attacker was using dies immediately instead of staying valid.
 */
export async function resetUserPassword(id: string, newPassword: string, mustChangePassword = true, actorId?: string): Promise<void> {
  const updated = await usersRepository.update(id, { mustChangePassword });
  await setUserPassword(id, newPassword);
  await revokeAllSessionsForUser(id);

  await auditRepository.append({
    eventType: 'user_password_reset',
    actorUserId: actorId,
    entityType: 'user',
    entityId: id,
    details: { role: updated.role, displayName: updated.displayName }
  });

  await sendNotification({
    templateKey: 'password_reset',
    to: updated.email,
    variables: { recipientName: updated.displayName, temporaryPassword: newPassword, loginUrl: '/login' },
    entityType: 'user',
    entityId: id
  });
}
