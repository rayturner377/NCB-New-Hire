import { randomBytes, randomUUID } from 'node:crypto';
import { auditRepository, usersRepository, type AppUser, type UserSearchFilters } from '@ncb/database';
import { setUserPassword, revokeAllSessionsForUser } from '@ncb/auth/utils';
import { issueAccessCode } from '../../auth/services/access-codes-service';
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
    permissionOverrides: { grant: overrides.grant ?? [], revoke: overrides.revoke ?? [] },
    delegateForClinicianId: user.delegateForClinicianId
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
  /** Overrides issueAccessCode's own default window for the activation code — see activation-code-ttl.ts's admin-facing presets (candidate creation only; staff creation has no picker and just takes the default). */
  activationCodeTtlMs?: number;
}

/**
 * Ported from server.js createUser/assertUniqueUserEmail (~L4629-4676). Email
 * uniqueness is checked here up front for a friendly error on the common
 * path, but the real guarantee is the database's own unique constraint
 * (schema.prisma's `@unique` on email) — two concurrent signups racing past
 * the findByEmail check would otherwise surface as a raw 500 from the
 * constraint violation, so that's caught below too and converted to the same
 * DuplicateEmailError.
 *
 * No admin-chosen password here anymore — see AccessCode's own doc comment
 * (schema.prisma) for why. The account gets a real Better Auth credential
 * (a random password nobody, including the admin, ever sees) so it exists
 * but can't be signed into, and a 6-digit activation code is emailed instead;
 * the new user redeems it at /forgot-password to choose their own password.
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
      delegateForClinicianId: input.delegateForClinicianId
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }

  // A real, unguessable credential the account can't actually be signed into
  // — Better Auth's sign-in only ever checks this Account row, never AppUser
  // directly, so the row has to exist, but nobody needs to know its value.
  await setUserPassword(created.id, randomBytes(32).toString('base64url'));

  const activationCode = await issueAccessCode(created.id, 'account_activation', input.activationCodeTtlMs);

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
    variables: { recipientName: created.displayName, email: created.email, activationCode, resetUrl: '/login' },
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

/** The paginated, filtered equivalent of listUsers — a role's list page uses this instead of fetching every account in the system and filtering/paginating in JS. */
export async function searchUsers(
  filters: UserSearchFilters,
  page: number,
  pageSize: number
): Promise<{ rows: UserSummary[]; total: number }> {
  const { rows, total } = await usersRepository.search(filters, page, pageSize);
  return { rows: rows.map(toSummary), total };
}

/** Total/active counts for one role — for the stat cards atop a role's list page, independent of which page of results is currently showing. */
export async function getUserRoleStats(role: string): Promise<{ total: number; active: number }> {
  return usersRepository.countByRole(role);
}

/** A single account's full summary — the edit page's own lookup (edit-role-user-container.tsx), where listUsers()'s whole-role-list scan would be wasteful for just one record. Null for a deleted/nonexistent user. */
export async function getUserById(id: string): Promise<UserSummary | null> {
  const user = await usersRepository.findById(id);
  return user ? toSummary(user) : null;
}

/** For the "last edited by" byline on a case's assessment (see MedicalCase.lastEditedById) — just the name, not a full profile. Null for a deleted/nonexistent user id rather than throwing, since the byline degrades gracefully to nothing in that case. */
export async function getUserDisplayName(id: string): Promise<string | null> {
  const user = await usersRepository.findById(id);
  return user?.displayName ?? null;
}

/** Active doctor accounts, for assigning a case directly to a clinician (medical-office rosters aren't wired up yet). */
export async function listActiveDoctors(): Promise<UserSummary[]> {
  const users = await usersRepository.listUsers();
  return users.filter((user) => user.role === 'clinician' && user.active).map(toSummary);
}

/** Every delegate account linked to this one doctor — the doctor's own "Delegates" tab (see my-delegates-container.tsx), distinct from /delegates' admin/reviewer-facing full roster. A doctor can have more than one delegate (the link is many-delegates-to-one-doctor), so this returns a list, not a single record. */
export async function listDelegatesForClinician(clinicianId: string): Promise<UserSummary[]> {
  const users = await usersRepository.listUsers();
  return users.filter((user) => user.role === 'delegate' && user.delegateForClinicianId === clinicianId).map(toSummary);
}

/** Whether `delegateId` is a delegate account currently linked to `clinicianId` — the doctor's own narrow self-service authority over their delegate(s) (activate/deactivate, the billing-view toggle), distinct from canManageUserAccount's broader admin/reviewer authority which a doctor never holds. */
export async function isOwnDelegate(clinicianId: string, delegateId: string): Promise<boolean> {
  const user = await usersRepository.findById(delegateId);
  return Boolean(user && user.role === 'delegate' && user.delegateForClinicianId === clinicianId);
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

/**
 * The Settings → User Policy break-glass toggle — bulk-flips every account's
 * twoFactorEnabled to match, since that's what Better Auth's `two-factor`
 * plugin actually checks (see packages/database/src/repositories/users.ts's
 * setTwoFactorEnabledForAll). Only meant for "outbound email is broken and
 * everyone is locked out of the new-device challenge" — audited distinctly
 * from a routine settings save since it immediately changes every account's
 * sign-in behavior, not just a display preference.
 */
export async function setDeviceVerificationRequiredForAll(enabled: boolean, actorId?: string): Promise<void> {
  const { count } = await usersRepository.setTwoFactorEnabledForAll(enabled);

  await auditRepository.append({
    eventType: enabled ? 'device_verification_enabled_for_all' : 'device_verification_disabled_for_all',
    actorUserId: actorId,
    details: { affectedUserCount: count }
  });
}

export interface UpdateUserInput extends UpdateUserSchemaInput {
  medicalProfile?: Record<string, unknown>;
  permissionOverrides?: { grant: string[]; revoke: string[] };
}

export async function updateUser(
  id: string,
  patch: UpdateUserInput,
  actorId?: string,
  audit?: { eventType: string; details?: Record<string, unknown> }
): Promise<UserSummary> {
  const updated = await usersRepository.update(id, patch);

  await auditRepository.append({
    eventType: audit?.eventType ?? 'user_updated',
    actorUserId: actorId,
    entityType: 'user',
    entityId: id,
    details: audit?.details ?? { role: updated.role, displayName: updated.displayName }
  });

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

  await auditRepository.append({
    eventType: 'password_changed',
    actorUserId: id,
    entityType: 'user',
    entityId: id
  });
}

/**
 * Admin/HR triggering a password reset on someone else's account — a
 * candidate who forgot theirs, or one that was typed wrong at creation.
 * No admin-chosen password anymore — see AccessCode's own doc comment
 * (schema.prisma). This just emails a 6-digit reset code; the account holder
 * redeems it at /forgot-password to choose their own new password. Kills
 * every existing session on the account immediately, unconditionally (there's
 * no "caller's own session" to preserve here — the actor is HR/admin, not the
 * account owner) — if this reset is happening because the account was
 * compromised, whatever session an attacker was using dies right away instead
 * of staying valid until the code is redeemed.
 */
export async function resetUserPassword(id: string, actorId?: string): Promise<void> {
  const updated = await usersRepository.findById(id);
  if (!updated) return;

  await revokeAllSessionsForUser(id);
  const resetCode = await issueAccessCode(id, 'password_reset');

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
    variables: { recipientName: updated.displayName, resetCode, resetUrl: '/login' },
    entityType: 'user',
    entityId: id
  });
}
