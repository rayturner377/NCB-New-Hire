import { NewRoleUserContainer } from '../../../../features/users/containers/new-role-user-container';

export default function NewReviewerPage() {
  return <NewRoleUserContainer role="reviewer" roleLabel="Reviewer" cancelHref="/reviewers" />;
}
