/** AppUser projected down to the shape safe to pass to client components. */
export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
  /** Doctor-only: facility/registration/rate — see lib/medical-profile.ts. Empty object for non-doctor roles. */
  medicalProfile: Record<string, unknown>;
  /** Extra permissions granted/revoked on top of this user's role — see lib/effective-permissions.ts's getEffectivePermissions. */
  permissionOverrides: { grant: string[]; revoke: string[] };
  /** Delegate-only: the one doctor this assistant acts on behalf of. Null for every other role. */
  delegateForClinicianId: string | null;
}
