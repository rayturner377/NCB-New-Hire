import { redirect } from 'next/navigation';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { MedicalOfficeForm } from '../components/medical-office-form';
import { getMedicalOfficeById } from '../services/medical-offices-service';

export interface EditMedicalOfficeContainerProps {
  officeId: string;
}

export async function EditMedicalOfficeContainer({ officeId }: EditMedicalOfficeContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  // Same permission create-medical-office.ts requires — see update-medical-office.ts's own comment
  // on why there's no separate MEDICAL_OFFICES_UPDATE permission.
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE)) {
    redirect(`/medical-offices/${officeId}`);
  }

  const office = await getMedicalOfficeById(officeId);
  if (!office) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Medical facility not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Edit {office.name}</h1>
        <p className="text-sm text-muted-foreground">Update this facility's details.</p>
      </div>
      <MedicalOfficeForm
        office={{
          id: office.id,
          name: office.name,
          addressLine1: office.addressLine1,
          addressLine2: office.addressLine2,
          city: office.city,
          state: office.state,
          country: office.country,
          phone: office.phone,
          email: office.email,
          defaultMedicalFee: Number(office.defaultMedicalFee)
        }}
      />
    </div>
  );
}
