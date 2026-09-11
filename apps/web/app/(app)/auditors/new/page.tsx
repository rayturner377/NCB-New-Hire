import { NewRoleUserContainer } from '../../../../features/users/containers/new-role-user-container';

export default function NewAuditorPage() {
  return <NewRoleUserContainer role="auditor" roleLabel="Auditor" cancelHref="/auditors" />;
}
