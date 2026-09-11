import { ListPageSkeleton } from '../../../components/dashboard/list-page-skeleton';

/**
 * Scoped to just the /candidates list (not the whole app) — this page
 * decrypts every candidate's encrypted profile payload and joins in their
 * cases, which is genuinely slower than most pages here. /candidates/new
 * and /candidates/[id] each define their own loading.tsx (nothing, and
 * DetailPageSkeleton respectively) so a fast create form doesn't inherit a
 * skeleton shaped for a totally different page.
 */
export default function Loading() {
  return <ListPageSkeleton />;
}
