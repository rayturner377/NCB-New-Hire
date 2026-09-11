import { AuditLogContainer } from '../../../features/audit/containers/audit-log-container';

export default async function AuditPage(
  props: { searchParams: Promise<{ type?: string; from?: string; to?: string; page?: string }> }
) {
  const searchParams = await props.searchParams;
  return <AuditLogContainer searchParams={searchParams} />;
}
