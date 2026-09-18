'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs } from '../../../components/ui/tabs';
import { resolveCaseTab } from '../case-navigation';

/** URL-backed tabs preserve the destination on refresh, copied links and browser Back. */
export function CaseWorkspaceTabs({ canViewHistory, children }: { canViewHistory: boolean; children: ReactNode }) {
  const params = useSearchParams();
  const tab = resolveCaseTab(params.get('tab'), canViewHistory);

  function changeTab(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', resolveCaseTab(value, canViewHistory));
    // Next integrates native history updates with useSearchParams. All tab content
    // is already loaded, so switching needs no additional server request.
    window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return <Tabs value={tab} onValueChange={changeTab}>{children}</Tabs>;
}
