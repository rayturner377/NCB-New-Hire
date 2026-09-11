import type { ReactNode } from 'react';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * A plain (borderless) form section — a heading, an optional one-line
 * description, and its fields. Sections are separated with a Separator
 * between them rather than each one living in its own bordered Card, so a
 * long form reads as one flowing document instead of a stack of boxes.
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
