import { redirect } from 'next/navigation';
import { listCandidates } from '../../candidates/services/candidates-service';
import { listActiveDoctors } from '../../users/services/users-service';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CaseForm } from '../components/case-form';

export async function NewCaseContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_CREATE)) {
    redirect('/cases');
  }

  const [candidates, doctors] = await Promise.all([listCandidates(), listActiveDoctors()]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">New medical case</h1>
        <p className="text-sm text-muted-foreground">
          A candidate profile must already exist. Search for it below, then optionally assign a doctor.
        </p>
      </div>
      <CaseForm candidates={candidates} doctors={doctors} />
    </div>
  );
}
