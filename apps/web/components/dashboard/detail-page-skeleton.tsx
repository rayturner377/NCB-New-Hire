import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

/** Instant placeholder for single-record pages (candidates/[id], cases/[id], doctors/[id], users/[id], medical-offices/[id]) — see list-page-skeleton.tsx's comment on why this exists. */
export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
