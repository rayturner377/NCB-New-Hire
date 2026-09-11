function isScrollable(el: Element): boolean {
  const style = getComputedStyle(el);
  return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
}

/** Walks up from a node to find the nearest ancestor that actually scrolls, falling back to the window. Lets a component drop into any page without that page having to know or pass down its own scroll container (e.g. AppShell's <main>, not window — the app body itself never scrolls). */
export function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let el = node?.parentElement ?? null;
  while (el && el !== document.body) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return window;
}

/** Resets whichever ancestor of `node` actually scrolls back to its top — e.g. so paging to the next tab of a long form starts the reader at the top of it, not wherever the previous tab happened to leave the scroll position. */
export function scrollNearestParentToTop(node: HTMLElement | null): void {
  const target = findScrollParent(node);
  if (target === window) {
    window.scrollTo({ top: 0 });
  } else {
    (target as HTMLElement).scrollTo({ top: 0 });
  }
}
