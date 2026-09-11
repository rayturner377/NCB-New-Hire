import { DoctorOverviewContainer } from '../../../../features/users/containers/doctor-overview-container';

export default async function DoctorOverviewPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return <DoctorOverviewContainer doctorId={params.id} searchParams={searchParams} />;
}
