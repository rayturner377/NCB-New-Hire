import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export interface ShortcutCardProps {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Renders a "Coming soon" badge and disables the link — for admin sections not built yet. */
  disabled?: boolean;
}

/** Administration quick-link tile, reused for every entry in the admin shortcuts grid. */
export function ShortcutCard({ label, icon: Icon, href, disabled = false }: ShortcutCardProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border p-4 transition-colors',
        disabled ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {disabled ? (
          <Badge variant="secondary" className="text-[10px]">
            Coming soon
          </Badge>
        ) : null}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (disabled) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}
