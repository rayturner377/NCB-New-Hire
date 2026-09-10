import { CandidateDetailContainer } from '../../../../features/candidates/containers/candidate-detail-container';

export default async function CandidateDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CandidateDetailContainer candidateId={params.id} />;
}
