'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { navItemsForRole } from '../../lib/nav-config';
import { NavList } from './nav-list';

export interface MobileNavProps {
  role: string;
}

/** See sidebar.tsx's comment: items are resolved client-side from `role`, not passed as props. */
export function MobileNav({ role }: MobileNavProps) {
  const items = navItemsForRole(role);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-4">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <NavList items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
