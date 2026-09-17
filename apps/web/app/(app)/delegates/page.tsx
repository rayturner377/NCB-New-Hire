import { redirect } from 'next/navigation';
import { RoleUsersContainer } from '../../../features/users/containers/role-users-container';
import { MyDelegatesContainer } from '../../../features/users/containers/my-delegates-container';
import { PERMISSIONS, ROLES } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';

export default async function DelegatesPage(props: { searchParams: Promise<{ query?: string; page?: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role === ROLES.DOCTOR) {
    return <MyDelegatesContainer />;
  }

  const searchParams = await props.searchParams;
  return (
    <RoleUsersContainer
      role="delegate"
      roleLabel="Delegates"
      roleLabelSingular="delegate"
      listPermission={PERMISSIONS.DELEGATES_LIST}
      newHref="/delegates/new"
      searchParams={searchParams}
    />
  );
}
