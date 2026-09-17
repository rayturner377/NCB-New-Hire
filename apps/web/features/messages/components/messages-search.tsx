'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { useDebouncedFilterNavigation } from '../../../lib/hooks/use-debounced-filter-navigation';

export interface MessagesSearchProps {
  query: string;
  folder: string;
}

function buildHref(folder: string, query: string): string {
  const params = new URLSearchParams();
  if (folder !== 'all') params.set('folder', folder);
  if (query) params.set('query', query);
  const search = params.toString();
  return search ? `/messages?${search}` : '/messages';
}

/** Same debounced-auto-navigate pattern as organization-billing-filters.tsx's candidate search — types locally, re-navigates to the same folder with `?query=` a beat after typing stops. */
export function MessagesSearch({ query: initialQuery, folder }: MessagesSearchProps) {
  const { navigateDebounced } = useDebouncedFilterNavigation();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function handleChange(value: string) {
    setQuery(value);
    navigateDebounced(buildHref(folder, value));
  }

  return (
    <div className="relative sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Search by recipient or subject…"
        className="h-9 pl-8"
      />
    </div>
  );
}
