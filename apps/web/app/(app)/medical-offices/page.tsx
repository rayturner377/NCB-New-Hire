import { redirect } from 'next/navigation';

/** Medical facilities now live as a tab on the Doctors page (see DoctorsWorkspaceContainer) rather than their own standalone destination — /medical-offices/new and /medical-offices/[id] (linked from that tab) still exist as real routes. */
export default function MedicalOfficesPage() {
  redirect('/doctors?tab=offices');
}
