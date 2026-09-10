import { ListPageSkeleton } from '../../../components/dashboard/list-page-skeleton';

/**
 * Scoped to just the /cases list (not the whole app) — same reasoning as
 * candidates/loading.tsx: this page joins and decrypts every case. /cases/new
 * and /cases/[id] each define their own loading.tsx (nothing, and
 * DetailPageSkeleton respectively).
 */
export default function Loading() {
  return <ListPageSkeleton />;
}
