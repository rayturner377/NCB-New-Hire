import { CasesContainer } from '../../../features/cases/containers/cases-container';

export default function CasesPage({
  searchParams
}: {
  searchParams: { tab?: string; query?: string; status?: string; billing?: string; from?: string; to?: string; page?: string };
}) {
  return <CasesContainer searchParams={searchParams} />;
}
