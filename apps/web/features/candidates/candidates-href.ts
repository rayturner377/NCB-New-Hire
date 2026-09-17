import type { BillingStatus } from '../cases/billing-status';

export interface CandidatesHrefParams {
  query: string;
  position: string;
  stage: string;
  billing: BillingStatus | '';
  page: number;
}

/**
 * Pure — no dependency on session/request state — so both candidates-container.tsx (a Server
 * Component, calling this directly to build a redirect URL) and candidates-table.tsx (a Client
 * Component) import it directly instead of the container passing it down as a function prop.
 * Next.js's Server/Client boundary can't carry a plain closure as a prop (only a "use server"
 * action), so this used to be a runtime error the moment CandidatesTable actually rendered.
 */
export function buildCandidatesHref({ query, position, stage, billing, page }: CandidatesHrefParams): string {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (position) params.set('position', position);
  if (stage) params.set('stage', stage);
  if (billing) params.set('billing', billing);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/candidates?${qs}` : '/candidates';
}
