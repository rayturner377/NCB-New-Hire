import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { PERMISSIONS } from '../../../lib/permissions';

export default function ReviewersPage() {
  return (
    <RoleUsersContainer
      role="reviewer"
      roleLabel="Reviewers"
      roleLabelSingular="reviewer"
      listPermission={PERMISSIONS.REVIEWERS_LIST}
      newHref="/reviewers/new"
    />
  );
}
