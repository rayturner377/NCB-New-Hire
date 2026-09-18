import { HrTurnaroundReportContainer } from '../../../../features/reports/containers/hr-turnaround-report-container';

export default async function HrTurnaroundReportPage(props: { searchParams: Promise<{ from?: string; to?: string; query?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  return <HrTurnaroundReportContainer searchParams={searchParams} />;
}
