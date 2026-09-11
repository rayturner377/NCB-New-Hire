import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../ui/button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Server-driven mode: builds the href for a given page number, keeping the caller's other query params (search, filters, ...) intact. */
  hrefForPage?: (page: number) => string;
  /** Client-driven mode: for tables whose data/filters already live in component state. */
  onPageChange?: (page: number) => void;
}

/**
 * Reused by any paginated table — server-rendered lists pass `hrefForPage`
 * (plain `<Link>` navigation, no client JS needed); tables that already hold
 * their rows/filters in client state pass `onPageChange` instead.
 */
export function Pagination({ page, totalPages, hrefForPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  function controlFor(targetPage: number, content: ReactNode) {
    if (targetPage < 1 || targetPage > totalPages) {
      return (
        <Button variant="outline" size="sm" disabled>
          {content}
        </Button>
      );
    }
    if (hrefForPage) {
      return (
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefForPage(targetPage)}>{content}</Link>
        </Button>
      );
    }
    return (
      <Button variant="outline" size="sm" onClick={() => onPageChange?.(targetPage)}>
        {content}
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {controlFor(
          page - 1,
          <>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </>
        )}
        {controlFor(
          page + 1,
          <>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </>
        )}
      </div>
    </div>
  );
}
