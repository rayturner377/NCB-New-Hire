'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { scrollNearestParentToTop } from '../../lib/scroll';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { FormProgress, type FormProgressSection } from './form-progress';

export interface TabbedFormShellTab {
  key: string;
  label: string;
  /** Omit for a tab with nothing to "complete" (e.g. a read-only reference tab) — it's left out of both the checkmark and the progress bar. */
  complete?: boolean;
  content: ReactNode;
  /**
   * Skips forceMount for this one tab, so its content only mounts once the
   * visitor actually opens it (and unmounts again when they leave) instead
   * of loading immediately with the rest of the page. Only safe for a tab
   * that contributes nothing to the surrounding `<form>`'s own submission —
   * e.g. a "Documents" tab that's just export/upload buttons with no named
   * fields — since forceMount is what keeps every *other* tab's fields in
   * FormData regardless of which one is active.
   */
  lazy?: boolean;
}

export interface TabbedFormShellProps {
  tabs: TabbedFormShellTab[];
  value: string;
  onValueChange: (value: string) => void;
  /** Called whenever Previous/Next moves to a different tab — e.g. to flush a pending autosave before this tab's fields leave view. */
  onNavigate?: () => void;
  /** Replaces the Next button on the tab named by `finalSlotTabKey` (or the actual last tab, if that's omitted) — typically a Submit button (plus a "why disabled" hint). Omit the whole footer nav row with `hideNav`. */
  lastTabSlot?: ReactNode;
  /**
   * Which tab shows `lastTabSlot` instead of a Next button — defaults to the
   * actual last tab. Set this when a tab comes after the "real" final step
   * for other reasons (e.g. an optional Documents tab tacked on after
   * Determination & Attestation) — the tab it names still gets the Submit
   * slot, and any tab genuinely after it in the array gets no Next/Submit at
   * all on its right side, just Previous.
   */
  finalSlotTabKey?: string;
  /** Hides the Previous/Next footer entirely — e.g. a fully read-only form where tab clicks are the only navigation. */
  hideNav?: boolean;
}

/**
 * The tab navigation shell shared by every multi-step medical form (the
 * patient's intake, the doctor's assessment) — sticky tab bar + completion
 * progress line, forceMount'd panels (so switching tabs never drops another
 * tab's fields from a submit's FormData), and Previous/Next buttons named
 * after the actual adjacent tab rather than a generic "Previous"/"Next".
 * Owns navigation and layout only — the surrounding `<form>`, its state, and
 * autosave stay with whichever form uses this.
 *
 * Every tab change — Previous/Next or clicking a tab directly — also resets
 * the page's scroll position back to the top. Without this, paging forward
 * from the bottom of a long tab (where Next actually lives) landed the
 * reader at the bottom of the next one too, since the browser has no reason
 * to move the scroll position on its own.
 */
export function TabbedFormShell({ tabs, value, onValueChange, onNavigate, lastTabSlot, finalSlotTabKey, hideNav = false }: TabbedFormShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = tabs.findIndex((tab) => tab.key === value);
  const isFirst = index <= 0;
  const isLast = index === tabs.length - 1;
  const showFinalSlot = finalSlotTabKey ? value === finalSlotTabKey : isLast;
  const previousTab = index > 0 ? tabs[index - 1] : null;
  const nextTab = index >= 0 && index < tabs.length - 1 ? tabs[index + 1] : null;

  const progressSections: FormProgressSection[] = tabs
    .filter((tab): tab is TabbedFormShellTab & { complete: boolean } => tab.complete !== undefined)
    .map((tab) => ({ key: tab.key, label: tab.label, complete: tab.complete }));

  function handleValueChange(next: string) {
    onValueChange(next);
    scrollNearestParentToTop(rootRef.current);
  }

  function goTo(nextIndex: number) {
    const target = tabs[Math.min(Math.max(nextIndex, 0), tabs.length - 1)];
    if (target) {
      onNavigate?.();
      handleValueChange(target.key);
    }
  }

  return (
    <Tabs ref={rootRef} value={value} onValueChange={handleValueChange}>
      <div className="sticky top-0 z-10 flex flex-col gap-1.5 bg-background pb-2 pt-1">
        <div className="overflow-x-auto">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {tab.complete ? (
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-600/80 text-white dark:bg-emerald-400/80">
                      <svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {progressSections.length > 0 ? <FormProgress sections={progressSections} /> : null}
      </div>

      {/*
        forceMount + a plain `hidden` class (not Radix's own data-state) keeps every tab's fields in
        the DOM and part of a submit's FormData regardless of which tab is currently visible —
        skipped for `lazy` tabs, see TabbedFormShellTab's comment.
        Note for whoever next touches a tab's completeness check: a hidden tab's fields are NOT
        reliably checkable via checkValidity() — both this `hidden` class and Radix's own `hidden`
        attribute on inactive TabsContent panels render as `display:none`, and the HTML spec exempts
        a `display:none` subtree from constraint validation entirely, so a required-but-empty field
        in a tab nobody has opened yet can silently report as "valid". Don't try to fix that by
        fighting the CSS here — patient-case-form.tsx's/doctor-case-form.tsx's
        recomputeActiveSectionCompletion already sidesteps it correctly, by only ever trusting a
        completeness check performed at a moment its own tab is genuinely the active one.
      */}
      {tabs.map((tab) =>
        tab.lazy ? (
          <TabsContent key={tab.key} value={tab.key} className="rounded-md border p-4">
            {tab.content}
          </TabsContent>
        ) : (
          <TabsContent key={tab.key} value={tab.key} forceMount className={cn('rounded-md border p-4', value !== tab.key && 'hidden')}>
            {tab.content}
          </TabsContent>
        )
      )}

      {hideNav ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => goTo(index - 1)} disabled={isFirst}>
            <ChevronLeft className="mr-1.5 h-4 w-4" /> {previousTab ? previousTab.label : 'Previous'}
          </Button>

          {showFinalSlot ? lastTabSlot : isLast ? null : (
            <Button type="button" onClick={() => goTo(index + 1)}>
              {nextTab ? nextTab.label : 'Next'} <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </Tabs>
  );
}
