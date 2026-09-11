import { MedicalOfficeDetailContainer } from '../../../../features/medical-offices/containers/medical-office-detail-container';

export default async function MedicalOfficeDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <MedicalOfficeDetailContainer officeId={params.id} />;
}
