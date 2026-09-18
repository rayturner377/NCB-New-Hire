import { TurnaroundReportContainer } from '../../../../features/reports/containers/turnaround-report-container';

export default async function TurnaroundReportPage(
  props: { searchParams: Promise<{ fromMilestone?: string; toMilestone?: string; from?: string; to?: string; query?: string; page?: string }> }
) {
  const searchParams = await props.searchParams;
  return <TurnaroundReportContainer searchParams={searchParams} />;
}
