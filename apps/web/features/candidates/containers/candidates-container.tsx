import { redirect } from 'next/navigation';
import { Card } from '../../../components/ui/card';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CandidateForm } from '../components/candidate-form';
import { CandidateList } from '../components/candidate-list';
import { listCandidates, listCandidatesForUser } from '../services/candidates-service';

export async function CandidatesContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (!hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_LIST)) {
    redirect('/');
  }

  const canCreate = hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_CREATE);
  const canAssign = hasPermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);

  // Doctors only see candidates assigned to them; reviewers/admins see everyone.
  const candidates =
    session.user.role === 'clinician'
      ? await listCandidatesForUser(session.user.id)
      : await listCandidates();

  return (
    <div className="candidates-page">
      <h1>Candidates</h1>

      {canCreate ? (
        <Card>
          <h2>New candidate</h2>
          <CandidateForm />
        </Card>
      ) : null}

      <Card>
        <h2>All candidates</h2>
        <CandidateList candidates={candidates} canAssign={canAssign} />
      </Card>
    </div>
  );
}
