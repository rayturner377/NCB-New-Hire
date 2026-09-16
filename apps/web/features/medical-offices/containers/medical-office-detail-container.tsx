import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { formatAddress } from '../../../lib/address';
import { formatCurrency } from '../../../lib/currency';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { DeleteMedicalOfficeButton, MedicalOfficeActiveSwitch } from '../components/medical-office-actions';
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

  const address = formatAddress({
    addressLine1: office.addressLine1 ?? '',
    addressLine2: office.addressLine2 ?? '',
    city: office.city ?? '',
    state: office.state ?? '',
    country: office.country ?? ''
  });

  const fields: [string, string][] = [
    ['Address', address || '—'],
    ['Phone', office.phone || '—'],
    ['Email', office.email || '—'],
    ['Default rate', formatCurrency(Number(office.defaultMedicalFee))]
  ];

  const canEdit = hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);

  return (
    <div className="flex flex-col gap-4 p-6">
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{office.name}</h1>
            <StatusBadge status={office.active ? 'active' : 'inactive'} />
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild>
                    <Link href={`/medical-offices/${office.id}/edit`} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <MedicalOfficeActiveSwitch officeId={office.id} active={office.active} />
              <DeleteMedicalOfficeButton officeId={office.id} officeName={office.name} />
            </div>
          ) : null}
        </div>
      </TooltipProvider>
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
