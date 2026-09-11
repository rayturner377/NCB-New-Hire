import { redirect } from 'next/navigation';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { MedicalOfficeForm } from '../components/medical-office-form';

export async function NewMedicalOfficeContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE)) {
    redirect('/doctors?tab=offices');
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">New medical facility</h1>
        <p className="text-sm text-muted-foreground">Doctors can be assigned to this facility once it's created.</p>
      </div>
      <MedicalOfficeForm />
    </div>
  );
}
