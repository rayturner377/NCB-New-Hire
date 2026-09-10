'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { isNavHrefActive, type NavChildItem, type NavItem } from '../../lib/nav-config';

export interface NavListProps {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Collapsed sidebar only: asks the parent to expand it back out, for a group item whose icon was clicked (see below) rather than a leaf link. */
  onRequestExpand?: () => void;
}

function hasActiveChild(pathname: string, search: string, children: readonly NavChildItem[] = []): boolean {
  return children.some((child) => isNavHrefActive(pathname, search, child.href));
}

/**
 * Shared between the desktop Sidebar and the mobile Sheet nav so the two
 * surfaces can never drift out of sync with each other or with nav-config.
 * Items with `children` render as an expand/collapse group (e.g. "Users")
 * rather than a plain link — collapsing the sidebar to icon-only hides the
 * children and the group icon just links to its own href instead.
 */
export function NavList({ items, collapsed = false, onNavigate, onRequestExpand }: NavListProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => items.find((item) => item.children && hasActiveChild(pathname, search, item.children))?.href ?? null
  );

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavHrefActive(pathname, search, item.href);

        if (!item.children) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              // Off everywhere in this list, not just tab-carrying hrefs — a
              // sidebar link sits in view (and so stays prefetched) for as
              // long as its own page is open, including while that page's
              // own filters do their own router.push to `?query=...` on the
              // very same pathname (e.g. /billing's financial-year picker,
              // /cases' filters). Next's App Router prefetch cache has shown
              // the sidebar's stale prefetched content for that bare
              // pathname right after such a push, undoing it a moment later
              // (see route-tabs.tsx for the same bug on a different surface).
              prefetch={false}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                active ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
            </Link>
          );
        }

        // A group icon-only in the collapsed rail: clicking it expands the
        // sidebar back out and opens this group, rather than navigating to
        // the group's own href — there's nowhere to show the children
        // otherwise, so a bare click would silently skip past them.
        if (collapsed) {
          return (
            <button
              key={item.href}
              type="button"
              title={item.label}
              onClick={() => {
                setOpenGroup(item.href);
                onRequestExpand?.();
              }}
              className={cn(
                'flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                hasActiveChild(pathname, search, item.children) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        }

        const isOpen = openGroup === item.href;
        return (
          <div key={item.href}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : item.href)}
              aria-expanded={isOpen}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
            </button>
            {isOpen ? (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l pl-3">
                {item.children.map((child) => {
                  const childActive = isNavHrefActive(pathname, search, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      // See the top-level Link above for why this is off everywhere here.
                      prefetch={false}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        childActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
