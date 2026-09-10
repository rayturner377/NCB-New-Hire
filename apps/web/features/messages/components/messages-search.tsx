'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';

export interface MessagesSearchProps {
  query: string;
  folder: string;
}

const DEBOUNCE_MS = 400;

/** Same debounced-auto-navigate pattern as organization-billing-filters.tsx's candidate search — types locally, re-navigates to the same folder with `?query=` a beat after typing stops. */
export function MessagesSearch({ query: initialQuery, folder }: MessagesSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (folder !== 'all') params.set('folder', folder);
      if (value) params.set('query', value);
      const search = params.toString();
      router.push(search ? `/messages?${search}` : '/messages');
    }, DEBOUNCE_MS);
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
