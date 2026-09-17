import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default async function AuditorsPage(props: { searchParams: Promise<{ query?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <RoleUsersContainer
      role="auditor"
      roleLabel="Auditors"
      roleLabelSingular="auditor"
      listPermission={PERMISSIONS.AUDITORS_LIST}
      newHref="/auditors/new"
      searchParams={searchParams}
    />
  );
}
