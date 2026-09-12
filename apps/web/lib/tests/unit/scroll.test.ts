// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findScrollParent, scrollNearestParentToTop } from '../../scroll';

function mockScrollable(el: HTMLElement, { scrollHeight = 0, clientHeight = 0, overflowY = 'visible' } = {}) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  el.style.overflowY = overflowY;
}

describe('findScrollParent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns window when no ancestor actually scrolls', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);

    expect(findScrollParent(child)).toBe(window);
  });

  it('returns the nearest ancestor whose overflow-y is auto/scroll and whose content overflows it', () => {
    const scrollable = document.createElement('div');
    mockScrollable(scrollable, { scrollHeight: 500, clientHeight: 200, overflowY: 'auto' });
    const child = document.createElement('div');
    scrollable.appendChild(child);
    document.body.appendChild(scrollable);

    expect(findScrollParent(child)).toBe(scrollable);
  });

  it('does not treat an overflow-auto element with no actual overflow as scrollable', () => {
    const notActuallyScrolling = document.createElement('div');
    mockScrollable(notActuallyScrolling, { scrollHeight: 100, clientHeight: 100, overflowY: 'auto' });
    const child = document.createElement('div');
    notActuallyScrolling.appendChild(child);
    document.body.appendChild(notActuallyScrolling);

    expect(findScrollParent(child)).toBe(window);
  });

  it('returns window for a null node', () => {
    expect(findScrollParent(null)).toBe(window);
  });
});

describe('scrollNearestParentToTop', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scrolls window to top when no scrollable ancestor exists', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const node = document.createElement('div');
    document.body.appendChild(node);

    scrollNearestParentToTop(node);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0 });
  });

  it('scrolls the nearest scrollable ancestor to top, not window', () => {
    const windowScrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const scrollable = document.createElement('div');
    mockScrollable(scrollable, { scrollHeight: 500, clientHeight: 200, overflowY: 'scroll' });
    scrollable.scrollTo = vi.fn();
    const child = document.createElement('div');
    scrollable.appendChild(child);
    document.body.appendChild(scrollable);

    scrollNearestParentToTop(child);

    expect(scrollable.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(windowScrollToSpy).not.toHaveBeenCalled();
  });
});
