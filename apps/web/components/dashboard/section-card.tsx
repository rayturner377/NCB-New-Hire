import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Card-with-header-and-optional-action-slot wrapper used by every dashboard
 * panel (doctor's inbox, HR's operations queue, patient's medicals list,
 * admin's shortcuts) so each one isn't hand-rolling the same
 * Card/CardHeader/CardTitle boilerplate.
 */
export function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
