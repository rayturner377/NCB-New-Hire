import { redirect } from 'next/navigation';
import { BillingReportContainer } from '../../../features/billing/containers/billing-report-container';
import { OrganizationBillingReportContainer } from '../../../features/billing/containers/organization-billing-report-container';
import { getSession } from '../../../lib/session';

export default async function BillingPage(
  props: {
    searchParams: Promise<{ clinicianId?: string; billing?: string; from?: string; to?: string; query?: string; fy?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role === 'clinician') {
    return <BillingReportContainer searchParams={searchParams} />;
  }
  return <OrganizationBillingReportContainer searchParams={searchParams} />;
}
