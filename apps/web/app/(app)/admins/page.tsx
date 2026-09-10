import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default function AdminsPage() {
  return (
    <RoleUsersContainer
      role="admin"
      roleLabel="Admins"
      roleLabelSingular="admin"
      listPermission={PERMISSIONS.USERS_MANAGE}
      newHref="/admins/new"
    />
  );
}
