import { DoctorsWorkspaceContainer } from '../../../features/users/containers/doctors-workspace-container';

export default function DoctorsPage({ searchParams }: { searchParams: { tab?: string } }) {
  return <DoctorsWorkspaceContainer searchParams={searchParams} />;
}
