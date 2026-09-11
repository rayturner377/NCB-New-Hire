import { DoctorsWorkspaceContainer } from '../../../features/users/containers/doctors-workspace-container';

export default async function DoctorsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  return <DoctorsWorkspaceContainer searchParams={searchParams} />;
}
