'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Shared by every URL-searchParams-driven filter bar (cases, candidates, users, billing reports,
 * messages): a dropdown/date change navigates immediately, while a text search debounces so it
 * doesn't re-fetch on every keystroke. Each of those filter bars used to hand-roll its own
 * `debounceRef`/cleanup/`clearTimeout` for this, and every one of them had the same latent bug —
 * `navigate()` (the immediate path) never cancelled a debounce timer already pending from an
 * earlier keystroke. That timer closed over the filter values as they stood *when the debounce was
 * scheduled*, so if a dropdown was changed while a search was still debouncing, the stale timer
 * later fired and silently reverted that dropdown back to its pre-change value. `navigate` here
 * cancels any pending debounced navigation before pushing, since the value it's about to push
 * already reflects whatever the user just typed — there's nothing left for the pending one to do.
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
