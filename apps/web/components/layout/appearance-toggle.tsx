'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { APPEARANCE_STORAGE_KEY } from '../../lib/appearance';
import { cn } from '../../lib/utils';
import { Switch } from '../ui/switch';

export interface AppearanceToggleProps {
  collapsed: boolean;
}

/**
 * A per-browser light/dark override, independent of Settings → Theme's
 * admin-wide default (features/settings/components/theme-settings-form.tsx)
 * — that setting decides what a first-time visitor sees; this lets any one
 * user flip their own view without changing it for anyone else. Persisted to
 * localStorage and applied by directly toggling the `dark` class on
 * `<html>` (the same class app/layout.tsx sets server-side from the admin
 * default) — a blocking inline script in that same layout applies whatever's
 * stored here before first paint, so there's no flash back to the admin
 * default on reload.
 *
 * Starts render-nothing until mounted: the *real* starting state lives on
 * `<html>`'s class list (set server-side, then possibly corrected by that
 * blocking script) rather than in any prop this component receives, so it
 * has to read the DOM once on mount before it can render the right icon/
 * switch position — rendering a guess first would just flash the wrong one.
 */
export function AppearanceToggle({ collapsed }: AppearanceToggleProps) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage blocked — the toggle still works for this tab, it just won't stick on reload.
    }
  }

  if (!mounted) {
    return <div className={cn('h-5', collapsed ? 'w-5' : 'w-full')} aria-hidden="true" />;
  }

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Switch checked={dark} onCheckedChange={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dark ? <Moon className="h-3.5 w-3.5" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5" aria-hidden="true" />}
        {dark ? 'Dark mode' : 'Light mode'}
      </span>
      <Switch checked={dark} onCheckedChange={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} />
    </div>
  );
}
