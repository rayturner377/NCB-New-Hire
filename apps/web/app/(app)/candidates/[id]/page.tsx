import { CandidateDetailContainer } from '../../../../features/candidates/containers/candidate-detail-container';

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  return <CandidateDetailContainer candidateId={params.id} />;
}
