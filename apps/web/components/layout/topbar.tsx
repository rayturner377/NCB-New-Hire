import { LogoMark } from '../brand/logo-mark';
import { MobileNav } from './mobile-nav';
import { PageHeading } from './page-heading';
import { UserMenu } from './user-menu';

export interface TopbarProps {
  user: { displayName: string; email: string; role: string };
  logoutAction: () => Promise<void>;
  logoSrc?: string;
}

export function Topbar({ user, logoutAction, logoSrc }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex items-center gap-3">
          <MobileNav role={user.role} />
          <LogoMark src={logoSrc} />
        </div>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
        <PageHeading />
      </div>
      <UserMenu displayName={user.displayName} email={user.email} role={user.role} logoutAction={logoutAction} />
    </header>
  );
}
