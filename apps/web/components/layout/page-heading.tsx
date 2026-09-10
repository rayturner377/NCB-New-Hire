'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';
import { navBreadcrumbsForPathname } from '../../lib/nav-config';

/**
 * Topbar's page title + (dashboard-only) date, derived from the route so
 * pages don't declare their own heading. On a subpage (e.g. /candidates/new)
 * this renders a breadcrumb trail — the parent section links back, the
 * current page doesn't. The query string matters here too, not just the
 * pathname — /doctors?tab=doctors and /doctors?tab=offices share a pathname
 * but should show different titles (see nav-config.ts's isNavHrefActive).
 */
export function PageHeading() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const crumbs = navBreadcrumbsForPathname(pathname, search);
  if (crumbs.length === 0) return null;

  const isDashboard = pathname === '/';

  return (
    <div className="hidden min-w-0 flex-col leading-tight sm:flex">
      <div className="flex items-center gap-1 truncate text-sm font-semibold">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              {isLast ? (
                <span className="truncate">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="truncate text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </div>
      {isDashboard ? (
        <span className="truncate text-xs text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      ) : null}
    </div>
  );
}
