import { NewRoleUserContainer } from '../../../../features/users/containers/new-role-user-container';

export default function NewDelegatePage() {
  return <NewRoleUserContainer role="delegate" roleLabel="Delegate" cancelHref="/delegates" />;
}
