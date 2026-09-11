import { Skeleton } from '../ui/skeleton';

export interface SkeletonListProps {
  rows?: number;
  /** Circle for a person/avatar-led row (review queue), square for an icon-led row (activity feed). */
  leadingShape?: 'circle' | 'square';
}

/** Generic loading placeholder for any list-shaped dashboard panel — a leading avatar/icon, two text lines, a trailing chip. */
export function SkeletonList({ rows = 5, leadingShape = 'circle' }: SkeletonListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Skeleton className={leadingShape === 'circle' ? 'h-9 w-9 shrink-0 rounded-full' : 'h-9 w-9 shrink-0 rounded-md'} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </li>
      ))}
    </ul>
  );
}
