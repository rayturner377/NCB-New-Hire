import { redirect } from 'next/navigation';
import { Card } from '../../../components/ui/card';
import { listCandidates } from '../../candidates/services/candidates-service';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { CaseForm } from '../components/case-form';
import { CaseList } from '../components/case-list';
import { listCases } from '../services/cases-service';

export async function CasesContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST)) {
    redirect('/');
  }

  const canCreate = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_CREATE);
  const canTransition = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_UPDATE);

  const [cases, candidates] = await Promise.all([listCases(), canCreate ? listCandidates() : Promise.resolve([])]);

  return (
    <div className="cases-page">
      <h1>Cases</h1>

      {canCreate ? (
        <Card>
          <h2>New case</h2>
          <CaseForm candidates={candidates} />
        </Card>
      ) : null}

      <Card>
        <h2>All cases</h2>
        <CaseList cases={cases} canTransition={canTransition} />
      </Card>
    </div>
  );
}
