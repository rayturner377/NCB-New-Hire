import { redirect } from 'next/navigation';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CandidateForm } from '../components/candidate-form';

export async function NewCandidateContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_CREATE)) {
    redirect('/candidates');
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">New candidate</h1>
        <p className="text-sm text-muted-foreground">Create the candidate&apos;s profile, and optionally grant them portal access.</p>
      </div>
      <CandidateForm />
    </div>
  );
}
