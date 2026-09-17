import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default async function ReviewersPage(props: { searchParams: Promise<{ query?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <RoleUsersContainer
      role="reviewer"
      roleLabel="Reviewers"
      roleLabelSingular="reviewer"
      listPermission={PERMISSIONS.REVIEWERS_LIST}
      newHref="/reviewers/new"
      searchParams={searchParams}
    />
  );
}
