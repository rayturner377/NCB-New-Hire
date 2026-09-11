import { createHash } from 'node:crypto';

/**
 * Extracted verbatim from server.js (hashForAudit, ~L5200). Reused as-is by the
 * Postgres audit hash chain (Branch 2) so `event_hash` computation stays consistent
 * with the existing file-based audit log's hashing behavior.
 */
export function hashForAudit(value: unknown): string {
  return createHash('sha256').update(String(value || '')).digest('hex');
}
