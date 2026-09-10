import { redirect } from 'next/navigation';
import { BillingReportContainer } from '../../../features/billing/containers/billing-report-container';
import { OrganizationBillingReportContainer } from '../../../features/billing/containers/organization-billing-report-container';
import { getSession } from '../../../lib/session';

export default async function BillingPage({
  searchParams
}: {
  searchParams: { clinicianId?: string; billing?: string; from?: string; to?: string; query?: string; fy?: string; page?: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role === 'clinician') {
    return <BillingReportContainer searchParams={searchParams} />;
  }
  return <OrganizationBillingReportContainer searchParams={searchParams} />;
}
