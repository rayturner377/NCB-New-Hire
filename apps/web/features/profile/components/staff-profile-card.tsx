import { SectionCard } from '../../../components/dashboard/section-card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { roleLabel } from '../../../lib/role-labels';

export interface StaffProfileCardProps {
  displayName: string;
  email: string;
  role: string;
}

/**
 * Staff accounts (admin/reviewer/auditor/clinician) have no PatientProfile
 * to edit — the fields this app collects for a candidate (DOB, address,
 * next of kin) simply don't exist on AppUser. This is a read-only identity
 * card rather than a form; a doctor's own facility/registration/rate
 * details are edited via /doctors/[id] (an admin-facing form), not here.
 */
export function StaffProfileCard({ displayName, email, role }: StaffProfileCardProps) {
  return (
    <SectionCard title="My profile" description="Account identity — contact an administrator to change any of this.">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Full name</Label>
          <Input value={displayName} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input value={email} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Role</Label>
          <Input value={roleLabel(role)} disabled />
        </div>
      </div>
    </SectionCard>
  );
}
