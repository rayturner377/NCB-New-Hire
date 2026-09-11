'use client';

import { useEffect, useRef, useState } from 'react';
import { findScrollParent } from '../../lib/scroll';
import { cn } from '../../lib/utils';

export interface ScrollProgressBarProps {
  className?: string;
  /** 'top' pins with `sticky` to the top of the scrolling container as content scrolls under it; 'bottom' pins to the bottom of the browser viewport for the whole time the page is open (default 'top'). */
  position?: 'top' | 'bottom';
}

/**
 * A thin "how far down this page am I" bar, meant to be dropped into any
 * page whose content can run long — it auto-detects whichever ancestor
 * actually scrolls (see findScrollParent) rather than assuming window
 * scroll.
 */
export function ScrollProgressBar({ className, position = 'top' }: ScrollProgressBarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = findScrollParent(sentinelRef.current);

    function update() {
      const el = target === window ? document.documentElement : (target as HTMLElement);
      const scrollTop = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0);
    }

    update();
    target.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // Content height can change without a scroll event (e.g. switching tabs, async data landing) — keep the bar honest.
    let observer: ResizeObserver | undefined;
    if (target !== window && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(target as HTMLElement);
    }

    return () => {
      target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={sentinelRef}
      className={cn(
        position === 'bottom' ? 'fixed inset-x-0 bottom-0' : 'sticky top-0',
        'z-20 h-1 w-full bg-transparent',
        className
      )}
    >
      <div className="h-full bg-primary/70 transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );
}
