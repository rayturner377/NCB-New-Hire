'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Shared by every URL-searchParams-driven filter bar (cases, candidates, users, billing reports,
 * messages): a dropdown/date change navigates immediately via `navigate`, while a text search
 * debounces via `navigateDebounced` so it doesn't re-fetch on every keystroke. `navigate` cancels
 * any pending debounced navigation before pushing — without that, a dropdown change made while a
 * search is still debouncing could be overwritten when the stale timer later fires with the
 * filter values as they stood before the dropdown changed.
 */
export function useDebouncedFilterNavigation(debounceMs = 400) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  function cancelPendingNavigation() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function navigate(href: string) {
    cancelPendingNavigation();
    router.push(href);
  }

  function navigateDebounced(href: string) {
    cancelPendingNavigation();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      router.push(href);
    }, debounceMs);
  }

  return { navigate, navigateDebounced };
}
