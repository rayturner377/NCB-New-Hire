import { NewRoleUserContainer } from '../../../../features/users/containers/new-role-user-container';

export default function NewAdminPage() {
  return <NewRoleUserContainer role="admin" roleLabel="Admin" cancelHref="/admins" />;
}
