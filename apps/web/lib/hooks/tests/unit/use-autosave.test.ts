// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '../../use-autosave';

// React 19's act() needs this explicitly under Vitest (only frameworks it
// auto-detects, like Jest/CRA, set it for you).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function formRefWithRealForm() {
  const form = document.createElement('form');
  document.body.appendChild(form);
  return { current: form } as React.RefObject<HTMLFormElement | null>;
}

describe('useAutosave', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts idle and does nothing when disabled', () => {
    const onSave = vi.fn();
    const formRef = formRefWithRealForm();
    const { result } = renderHook(() => useAutosave({ formRef, disabled: true, onSave }));

    expect(result.current.status).toBe('idle');
    act(() => result.current.notifyChange());
    expect(result.current.status).toBe('idle');
  });

  it('does nothing on saveNow() when the form ref is not attached', async () => {
    const onSave = vi.fn();
    const formRef = { current: null } as React.RefObject<HTMLFormElement | null>;
    const { result } = renderHook(() => useAutosave({ formRef, onSave }));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('marks dirty immediately on change, then saves after the debounce window', async () => {
    vi.useFakeTimers();
    try {
      const onSave = vi.fn().mockResolvedValue(true);
      const formRef = formRefWithRealForm();
      const { result } = renderHook(() => useAutosave({ formRef, debounceMs: 1000, maxWaitMs: 20000, onSave }));

      act(() => result.current.notifyChange());
      expect(result.current.status).toBe('dirty');

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets status to error when onSave resolves false', async () => {
    vi.useFakeTimers();
    try {
      const onSave = vi.fn().mockResolvedValue(false);
      const formRef = formRefWithRealForm();
      const { result } = renderHook(() => useAutosave({ formRef, debounceMs: 100, onSave }));

      await act(async () => {
        result.current.notifyChange();
        vi.advanceTimersByTime(100);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets status to error when onSave throws', async () => {
    vi.useFakeTimers();
    try {
      const onSave = vi.fn().mockRejectedValue(new Error('network error'));
      const formRef = formRefWithRealForm();
      const { result } = renderHook(() => useAutosave({ formRef, debounceMs: 100, onSave }));

      await act(async () => {
        result.current.notifyChange();
        vi.advanceTimersByTime(100);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs a save immediately via saveNow(), bypassing the debounce', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const formRef = formRefWithRealForm();
    const { result } = renderHook(() => useAutosave({ formRef, debounceMs: 60000, onSave }));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });
});
