// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push })
}));

const { useDebouncedFilterNavigation } = await import('../../use-debounced-filter-navigation');

describe('useDebouncedFilterNavigation', () => {
  beforeEach(() => {
    push.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigate() pushes immediately', () => {
    const { result } = renderHook(() => useDebouncedFilterNavigation());
    result.current.navigate('/cases?status=reviewed');
    expect(push).toHaveBeenCalledWith('/cases?status=reviewed');
  });

  it('navigateDebounced() waits the full delay before pushing', () => {
    const { result } = renderHook(() => useDebouncedFilterNavigation());
    result.current.navigateDebounced('/cases?query=jane');

    vi.advanceTimersByTime(399);
    expect(push).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(push).toHaveBeenCalledWith('/cases?query=jane');
  });

  it('a later keystroke resets the pending debounce rather than stacking two navigations', () => {
    const { result } = renderHook(() => useDebouncedFilterNavigation());
    result.current.navigateDebounced('/cases?query=j');
    vi.advanceTimersByTime(200);
    result.current.navigateDebounced('/cases?query=ja');

    vi.advanceTimersByTime(400);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/cases?query=ja');
  });

  it("an immediate navigate() cancels a pending debounced one, so a stale query never overwrites the dropdown's own change", () => {
    const { result } = renderHook(() => useDebouncedFilterNavigation());
    // Typing "jane" schedules a debounced push carrying the status as it stood at that moment.
    result.current.navigateDebounced('/cases?query=jane&status=');
    vi.advanceTimersByTime(200);
    // The person then immediately changes the status dropdown before the debounce fires.
    result.current.navigate('/cases?query=jane&status=reviewed');

    // The stale debounced push must never fire and clobber the dropdown's change.
    vi.advanceTimersByTime(400);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/cases?query=jane&status=reviewed');
  });

  it('clears the pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useDebouncedFilterNavigation());
    result.current.navigateDebounced('/cases?query=jane');
    unmount();

    vi.advanceTimersByTime(400);

    expect(push).not.toHaveBeenCalled();
  });
});
