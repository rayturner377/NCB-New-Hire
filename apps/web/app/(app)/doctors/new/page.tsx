import { NewRoleUserContainer } from '../../../../features/users/containers/new-role-user-container';

export default function NewDoctorPage() {
  return <NewRoleUserContainer role="clinician" roleLabel="Doctor" cancelHref="/doctors" />;
}
