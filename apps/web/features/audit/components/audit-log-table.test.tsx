import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditLogTable } from './audit-log-table';
import type { AuditLogRow } from '../services/audit-log-service';

const row: AuditLogRow = {
  id: 'synthetic-event', occurredAt: '2026-09-17T12:00:00Z', action: 'Payment confirmed',
  actorName: 'Synthetic reviewer', actorRole: 'Reviewer', entityKind: 'Patient case',
  entityLabel: 'Synthetic patient', href: '/cases/synthetic-case?tab=billing', detail: 'Paid'
};

describe('audit log links', () => {
  it('renders a real anchor to the relevant tab with a descriptive accessible name', () => {
    const html = renderToStaticMarkup(<AuditLogTable rows={[row]} />);
    expect(html).toContain('href="/cases/synthetic-case?tab=billing"');
    expect(html).toContain('aria-label="Payment confirmed: Synthetic patient"');
    expect(html).toContain('underline');
  });

  it('keeps unavailable records readable without an anchor', () => {
    const html = renderToStaticMarkup(<AuditLogTable rows={[{ ...row, href: null, entityLabel: 'Deleted case' }]} />);
    expect(html).toContain('Deleted case');
    expect(html).not.toContain('<a ');
  });
});
