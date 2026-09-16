import { EditRoleUserContainer } from '../../../../../features/users/containers/edit-role-user-container';

export default async function EditAdminPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EditRoleUserContainer userId={params.id} roleLabel="Admin" cancelHref="/admins" />;
}
