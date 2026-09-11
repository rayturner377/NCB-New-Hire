import Link from 'next/link';
import { cn } from '../../lib/utils';

export interface RouteTab {
  key: string;
  label: string;
  href: string;
}

export interface RouteTabsProps {
  tabs: RouteTab[];
  activeKey: string;
}

/**
 * A tab bar styled exactly like components/ui/tabs.tsx's TabsList/TabsTrigger,
 * but backed by real navigation (`<Link>`) instead of Radix's client-side tab
 * state — for pages where each tab is its own server-rendered route rather
 * than a client-side toggle over data that's all fetched up front. Use this
 * (with the caller rendering only the active tab's content) whenever
 * switching tabs should mean "fetch just this tab's data," not "reveal a
 * panel that was already loaded" — see cases-container.tsx and
 * doctors-workspace-container.tsx.
 */
export function RouteTabs({ tabs, activeKey }: RouteTabsProps) {
  return (
    // self-start: every caller places this directly inside a `flex flex-col`
    // page container, whose default `align-items: stretch` would otherwise
    // stretch this inline-flex box to the full container width — at which
    // point `justify-center` below centers the tabs instead of leaving them
    // left-aligned with the rest of the page's content.
    <div className="inline-flex h-9 shrink-0 items-center justify-center self-start rounded-lg bg-muted p-1 text-muted-foreground">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          // Two tabs can share a pathname and differ only by `?tab=` — Next's
          // prefetch cache for the App Router has keyed same-pathname links
          // together in the past regardless of search params, which showed
          // the wrong tab's (stale, prefetched) content for a moment before
          // self-correcting. Prefetching is a pure perf optimization here
          // (each tab's own data is already meant to load fresh on demand,
          // see cases-container.tsx/doctors-workspace-container.tsx), so
          // it's not worth the risk of stale cross-tab content.
          prefetch={false}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            activeKey === tab.key ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
