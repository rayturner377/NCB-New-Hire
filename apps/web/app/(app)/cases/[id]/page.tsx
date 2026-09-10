import { CaseDetailContainer } from '../../../../features/cases/containers/case-detail-container';

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  return <CaseDetailContainer caseId={params.id} />;
}
