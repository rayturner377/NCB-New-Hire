'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions {
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Skip entirely — e.g. a read-only/submitted form. */
  disabled?: boolean;
  /** How long to wait after the last change before saving (default 2s). */
  debounceMs?: number;
  /** Hard ceiling so continuous activity (e.g. typing a long answer) still saves periodically, not just once you pause (default 20s). */
  maxWaitMs?: number;
  /** Receives the form's current data; return whether the save succeeded. */
  onSave: (formData: FormData) => Promise<boolean>;
}

/**
 * Debounce-plus-ceiling autosave, the same combination most editors/BPM
 * tools use (Google Docs, Notion, Pega/Appian-style process forms): a short
 * debounce so a save doesn't fire on every keystroke, but a hard `maxWaitMs`
 * ceiling so someone typing continuously for a long answer still gets saved
 * periodically rather than only once they finally pause. A save already in
 * flight is never abandoned mid-request; if more changes arrive while it's
 * running, exactly one more save runs immediately after (not one per
 * keystroke queued up).
 */
export function useAutosave({ formRef, disabled = false, debounceMs = 2000, maxWaitMs = 20000, onSave }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  function clearTimers() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (maxWaitTimer.current) {
      clearTimeout(maxWaitTimer.current);
      maxWaitTimer.current = null;
    }
  }

  const runSave = useCallback(async () => {
    const form = formRef.current;
    if (!form || disabled) return;
    clearTimers();

    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }

    savingRef.current = true;
    setStatus('saving');
    try {
      const ok = await onSave(new FormData(form));
      setStatus(ok ? 'saved' : 'error');
    } catch {
      setStatus('error');
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void runSave();
      }
    }
  }, [disabled, formRef, onSave]);

  const notifyChange = useCallback(() => {
    if (disabled) return;
    setStatus('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void runSave(), debounceMs);
    if (!maxWaitTimer.current) {
      maxWaitTimer.current = setTimeout(() => void runSave(), maxWaitMs);
    }
  }, [disabled, debounceMs, maxWaitMs, runSave]);

  useEffect(() => clearTimers, []);

  // Best-effort warning — browsers block real async work in this handler, so this can't force a save, only ask the user to stay.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (status === 'dirty' || status === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  return { status, notifyChange, saveNow: runSave };
}
