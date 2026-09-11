import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default function AuditorsPage() {
  return (
    <RoleUsersContainer
      role="auditor"
      roleLabel="Auditors"
      roleLabelSingular="auditor"
      listPermission={PERMISSIONS.AUDITORS_LIST}
      newHref="/auditors/new"
    />
  );
}
