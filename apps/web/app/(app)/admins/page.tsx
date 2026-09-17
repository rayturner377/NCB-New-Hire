import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default async function AdminsPage(props: { searchParams: Promise<{ query?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <RoleUsersContainer
      role="admin"
      roleLabel="Admins"
      roleLabelSingular="admin"
      listPermission={PERMISSIONS.USERS_MANAGE}
      newHref="/admins/new"
      searchParams={searchParams}
    />
  );
}
