import { AuditLogContainer } from '../../../features/audit/containers/audit-log-container';

export default function AuditPage({ searchParams }: { searchParams: { type?: string; from?: string; to?: string; page?: string } }) {
  return <AuditLogContainer searchParams={searchParams} />;
}
