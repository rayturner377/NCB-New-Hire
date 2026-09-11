import { CaseDetailContainer } from '../../../../features/cases/containers/case-detail-container';

export default async function CaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CaseDetailContainer caseId={params.id} />;
}
