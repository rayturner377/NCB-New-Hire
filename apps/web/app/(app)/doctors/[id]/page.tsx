import { DoctorOverviewContainer } from '../../../../features/users/containers/doctor-overview-container';

export default function DoctorOverviewPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { status?: string; from?: string; to?: string; page?: string };
}) {
  return <DoctorOverviewContainer doctorId={params.id} searchParams={searchParams} />;
}
