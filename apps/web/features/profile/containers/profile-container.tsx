import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { getSession } from '../../../lib/session';
import { listCandidatesForUser } from '../../candidates/services/candidates-service';
import { PatientProfileForm } from '../components/patient-profile-form';
import { SignOutOtherSessionsButton } from '../components/sign-out-other-sessions-button';
import { StaffProfileCard } from '../components/staff-profile-card';

/** "My profile" — reached from the account dropdown next to Sign out, not a sidebar destination. A patient edits their own contact/next-of-kin details here (see PatientProfileForm); every other role gets a read-only identity card, since AppUser has no editable profile fields of its own beyond password (already handled by the separate change-password flow). */
export async function ProfileContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role === 'patient') {
    const own = (await listCandidatesForUser(session.user.id))[0];
    if (!own) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">No candidate profile is linked to your account yet.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 p-6">
        <PatientProfileForm candidate={own} email={session.user.email} />
        <SectionCard title="Security" description="Signed in on a device that isn't yours anymore? Sign it out from here.">
          <SignOutOtherSessionsButton />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <StaffProfileCard displayName={session.user.displayName} email={session.user.email} role={session.user.role} />
      <SectionCard title="Security" description="Signed in on a device that isn't yours anymore? Sign it out from here.">
        <SignOutOtherSessionsButton />
      </SectionCard>
    </div>
  );
}
