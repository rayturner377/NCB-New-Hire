import { EditRoleUserContainer } from '../../../../../features/users/containers/edit-role-user-container';

export default async function EditAuditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EditRoleUserContainer userId={params.id} roleLabel="Auditor" cancelHref="/auditors" />;
}
