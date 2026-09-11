import { getPatientDashboardData } from '../../services/patient/patient-dashboard-service';
import { PatientDashboard } from '../../components/patient/patient-dashboard';

export interface PatientDashboardContainerProps {
  userId: string;
}

export async function PatientDashboardContainer({ userId }: PatientDashboardContainerProps) {
  const data = await getPatientDashboardData(userId);
  return <PatientDashboard data={data} />;
}
