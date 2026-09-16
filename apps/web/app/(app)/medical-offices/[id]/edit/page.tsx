import { EditMedicalOfficeContainer } from '../../../../../features/medical-offices/containers/edit-medical-office-container';

export default async function MedicalOfficeEditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EditMedicalOfficeContainer officeId={params.id} />;
}
