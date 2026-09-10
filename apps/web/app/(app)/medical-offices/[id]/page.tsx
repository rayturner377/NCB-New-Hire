import { MedicalOfficeDetailContainer } from '../../../../features/medical-offices/containers/medical-office-detail-container';

export default function MedicalOfficeDetailPage({ params }: { params: { id: string } }) {
  return <MedicalOfficeDetailContainer officeId={params.id} />;
}
