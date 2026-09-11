import Image from 'next/image';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

export interface LogoMarkProps {
  size?: 'sm' | 'lg';
  className?: string;
  /** Renders on a dark background (right-hand auth panel) instead of the default light chrome. */
  inverted?: boolean;
  /**
   * Uploaded logo URL. Nothing uploads one yet — Administration → Settings
   * will eventually store a small (topbar) and large (login screen) logo
   * and pass the right one in here. Until then this renders a skeleton
   * placeholder sized for that slot.
   */
  src?: string;
}

const DIMENSIONS = {
  sm: 'h-8 w-28',
  lg: 'h-12 w-44'
} as const;

export function LogoMark({ size = 'sm', className, inverted = false, src }: LogoMarkProps) {
  if (src) {
    return (
      <div className={cn('relative', DIMENSIONS[size], className)}>
        {/* unoptimized: the source is an uploaded/external asset whose host isn't known ahead of time for next/image's remotePatterns allowlist. */}
        <Image src={src} alt="Organization logo" fill unoptimized className="object-contain" />
      </div>
    );
  }

  return (
    <Skeleton
      className={cn(DIMENSIONS[size], inverted && 'bg-primary-foreground/10', className)}
      aria-label="Logo placeholder"
    />
  );
}
