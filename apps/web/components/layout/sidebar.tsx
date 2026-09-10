'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { navItemsForRole } from '../../lib/nav-config';
import { AppearanceToggle } from './appearance-toggle';
import { NavList } from './nav-list';

export interface SidebarProps {
  role: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * Resolves its own nav items from `role` (a plain string) rather than
 * receiving a pre-built NavItem[] as a prop — the items carry Lucide icon
 * *components*, and React Server Components can't serialize a function
 * across the server/client boundary when a parent Server Component passes
 * them down as props.
 *
 * Collapsed/expanded is owned by AppShell now (not this component) — the
 * Topbar's logo needs to follow the same state, so there's one source of
 * truth for it one level up instead of two independent copies.
 */
export function Sidebar({ role, collapsed, onCollapsedChange }: SidebarProps) {
  const items = navItemsForRole(role);

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r bg-card transition-[width] duration-150 md:flex',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex flex-1 flex-col gap-1 p-3">
        <NavList items={items} collapsed={collapsed} onRequestExpand={() => onCollapsedChange(false)} />
      </div>
      <div className="flex flex-col gap-2 border-t p-2">
        <AppearanceToggle collapsed={collapsed} />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
