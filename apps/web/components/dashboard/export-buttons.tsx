'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

export interface ExportButtonsProps {
  /** The export route with every current filter already in the query string, minus `format` — each menu item appends `format=csv`/`format=xlsx` itself. */
  href: string;
}

/**
 * One "Export" button opening a CSV/Excel choice, shared by every report/list that offers a
 * download (billing, turnaround, all cases) — a single dropdown reads better than two separate
 * buttons competing for the same spot, and keeps the choice consistent everywhere it appears.
 */
export function ExportButtons({ href }: ExportButtonsProps) {
  const separator = href.includes('?') ? '&' : '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`${href}${separator}format=csv`} prefetch={false} className="flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            CSV
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${href}${separator}format=xlsx`} prefetch={false} className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Excel
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
