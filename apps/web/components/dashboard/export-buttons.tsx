import { Download } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

export interface ExportButtonsProps {
  /** The export route with every current filter already in the query string, minus `format` — this appends `format=csv`/`format=xlsx` itself. */
  href: string;
}

/** CSV + Excel export, side by side — shared by every report/list that offers a download (billing, turnaround, all cases), so the two buttons/labels/icon stay identical everywhere rather than five slightly-different copies. */
export function ExportButtons({ href }: ExportButtonsProps) {
  const separator = href.includes('?') ? '&' : '?';
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`${href}${separator}format=csv`} prefetch={false}>
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`${href}${separator}format=xlsx`} prefetch={false}>
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Excel
        </Link>
      </Button>
    </div>
  );
}
