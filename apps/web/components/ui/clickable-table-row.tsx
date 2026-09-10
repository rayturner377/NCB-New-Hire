'use client';

// nextjs-toploader's own useRouter, not next/navigation's — it wraps push/replace with
// nprogress.start() before delegating to the real router. The library's own top-of-page
// bar otherwise only triggers off clicking a real <a> (a delegated document click listener
// walking up to the nearest anchor ancestor); a <tr> driving navigation via router.push()
// never matches that, so a table row's click silently skipped the loading bar entirely —
// this was the actual cause of "clicking a case just pauses with no feedback".
import { useRouter } from 'nextjs-toploader/app';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TableRow } from './table';

export interface ClickableTableRowProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * A `<TableRow>` that navigates like a link, for DataTable's `getRowHref` —
 * kept as its own small client component so DataTable itself stays
 * server-safe for the (more common) non-interactive-row case. Same accent
 * background/text hover as every other interactive list row in the app
 * (NavList, ShortcutCard, ...).
 */
export function ClickableTableRow({ href, className, children }: ClickableTableRowProps) {
  const router = useRouter();

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
      className={cn('cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground', className)}
    >
      {children}
    </TableRow>
  );
}
