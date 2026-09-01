import { auditRepository } from '../repositories/audit.js';

/**
 * Pre-launch integrity check: walks the whole audit_events chain and confirms
 * every event_hash matches its recomputed value. Run with:
 *   npm run build -w @ncb/database && npm run verify-audit-chain -w @ncb/database
 */
async function main(): Promise<void> {
  const result = await auditRepository.verifyChain();
  if (result.valid) {
    console.log('Audit chain OK: all events verified.');
    return;
  }
  console.error(`Audit chain BROKEN at audit_events.id = ${result.brokenAtId}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Failed to verify audit chain:', error);
  process.exitCode = 1;
});
