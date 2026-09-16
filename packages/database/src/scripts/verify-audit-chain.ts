import { auditRepository } from '../repositories/audit.js';

/**
 * Pre-launch integrity check: walks the whole audit_events chain and confirms
 * every event_hash matches its recomputed value. Run with:
 *   npm run build -w @ncb/database && npm run verify-audit-chain -w @ncb/database
 */
async function main(): Promise<void> {
  const result = await auditRepository.verifyChain();
  if (!result.valid) {
    console.error(`Audit chain BROKEN at audit_events.id = ${result.brokenAtId} (checkpoint: ${result.checkpointStatus})`);
    process.exitCode = 1;
    return;
  }
  if (result.checkpointStatus === 'missing') {
    // Not a failure — but a genuinely weaker result than 'verified', and worth saying out loud
    // rather than reporting the same reassuring "OK" either way (see ChainVerification's own doc
    // comment on why this state exists at all).
    console.log(
      'Audit chain internally consistent, but NOT independently verified: no Redis checkpoint exists yet ' +
        '(a fresh install, a deployment from before this check existed, or Redis lost the key). ' +
        'This result only reflects internal hash-chain linkage, not the stronger tamper-evidence checkpointing normally provides.'
    );
    return;
  }
  console.log('Audit chain OK: all events verified, and confirmed against the independent checkpoint.');
}

main().catch((error) => {
  console.error('Failed to verify audit chain:', error);
  process.exitCode = 1;
});
