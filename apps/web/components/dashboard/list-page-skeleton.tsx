import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export interface ListPageSkeletonProps {
  rows?: number;
}

/**
 * Instant placeholder for the table/dashboard-shaped pages (candidates,
 * cases, doctors, reviewers, admins, auditors, users, medical offices,
 * submissions, review, home) — Next's `loading.tsx` renders this the moment
 * navigation starts, before the route's server component has even fetched
 * data, so a click gets an immediate visual response instead of a frozen
 * page. Used as `app/(app)/loading.tsx`, the shared fallback for anything
 * under the signed-in shell that doesn't define a more specific one.
 */
export function ListPageSkeleton({ rows = 6 }: ListPageSkeletonProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-6 w-48" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-24 px-3 py-2.5">
            <div className="flex h-full flex-col justify-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 flex-[2]" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
