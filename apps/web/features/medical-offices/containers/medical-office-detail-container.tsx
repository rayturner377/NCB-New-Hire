import { redirect } from 'next/navigation';
import { formatCurrency } from '../../../lib/currency';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getMedicalOfficeById } from '../services/medical-offices-service';

export interface MedicalOfficeDetailContainerProps {
  officeId: string;
}

export async function MedicalOfficeDetailContainer({ officeId }: MedicalOfficeDetailContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_LIST)) {
    redirect('/');
  }

  const office = await getMedicalOfficeById(officeId);
  if (!office) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Medical facility not found.</p>
      </div>
    );
  }

  const fields: [string, string][] = [
    ['Address', office.address || '—'],
    ['Phone', office.phone || '—'],
    ['Email', office.email || '—'],
    ['Default rate', formatCurrency(Number(office.defaultMedicalFee))]
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{office.name}</h1>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
