import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DoctorDashboardContainer } from '../../dashboard/containers/doctor/doctor-dashboard-container';
import { Button } from '../../../components/ui/button';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listUsers } from '../services/users-service';

export interface DoctorOverviewContainerProps {
  doctorId: string;
  searchParams?: { status?: string; from?: string; to?: string; page?: string };
}

/** Read-only view of one doctor's own dashboard (their case inbox/history/metrics), reached from the Doctors list — reuses the same DoctorDashboardContainer a signed-in doctor sees for themselves, just parameterized by clinicianId instead of the viewer's own session. */
export async function DoctorOverviewContainer({ doctorId, searchParams = {} }: DoctorOverviewContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.DOCTORS_LIST)) {
    redirect('/');
  }

  const doctor = (await listUsers()).find((user) => user.id === doctorId && user.role === 'clinician');
  if (!doctor) {
    redirect('/doctors');
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <Button variant="link" size="sm" className="h-auto p-0" asChild>
          <Link href="/doctors">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to doctors
          </Link>
        </Button>
        <h1 className="mt-1 text-xl font-semibold">{doctor.displayName}</h1>
        <p className="text-sm text-muted-foreground">{doctor.email}</p>
      </div>
      <DoctorDashboardContainer clinicianId={doctor.id} basePath={`/doctors/${doctorId}`} isOwnDashboard={false} searchParams={searchParams} />
    </div>
  );
}
