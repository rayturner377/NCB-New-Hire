import { CasesContainer } from '../../../features/cases/containers/cases-container';

export default async function CasesPage(
  props: {
    searchParams: Promise<{ tab?: string; query?: string; status?: string; billing?: string; from?: string; to?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return <CasesContainer searchParams={searchParams} />;
}
