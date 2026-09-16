import { createHash } from 'node:crypto';
import { hashForAudit } from '@ncb/shared';
import { redis } from '@ncb/redis';
import type { AuditEvent, PrismaClient } from '../generated/client/index.js';
import { auditPrisma } from '../client.js';

// Arbitrary fixed key for the Postgres session-level advisory lock that
// serializes audit-chain writes (same locking primitive database/index.js
// already used for migrations), so two concurrent appends can't compute the
// same prevHash.
const ADVISORY_LOCK_KEY = 872_346_501;

/**
 * A second, independent record of "how far the chain had gotten," outside the same table the chain
 * itself lives in — confirmed the hard way (external security review, not an assumption) that
 * verifyChain()'s pure internal-consistency walk has a real blind spot: deleting the newest rows (or
 * the whole table) leaves whatever remains perfectly self-consistent, so it reports `valid: true`
 * even though real events are gone. Redis is a genuinely separate store/process from Postgres, so
 * someone with only Postgres access (even full superuser — see the DB-role split alongside this)
 * can't retroactively rewrite what was checkpointed here. Every append() overwrites this key with the
 * row it just created; verifyChain() below compares it against current Postgres state and treats any
 * mismatch as conclusive proof of tampering, not just a hint.
 */
const CHECKPOINT_KEY = 'audit:chain-checkpoint';

interface AuditCheckpoint {
  id: string;
  eventHash: string;
}

async function readCheckpoint(): Promise<AuditCheckpoint | null> {
  const raw = await redis.get(CHECKPOINT_KEY);
  return raw ? (JSON.parse(raw) as AuditCheckpoint) : null;
}

/**
 * Atomic compare-and-set: only actually writes when `id` is strictly greater than whatever's
 * currently stored (or nothing is stored yet) — confirmed via external security review that a plain
 * unconditional `SET` had a real reordering race. The Postgres advisory lock in append() only
 * serializes the *database* write; once that transaction commits and the lock releases, nothing
 * stopped two concurrent appends' *Redis* writes from landing out of order (a delayed older append's
 * write completing after a newer one's, silently moving the checkpoint backward). Done as a Lua
 * script so the read-compare-write is one atomic operation on the Redis server itself, not a
 * check-then-act race in this process.
 */
const ADVANCE_IF_NEWER_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if ok and decoded.id and tonumber(decoded.id) >= tonumber(ARGV[2]) then
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;

async function writeCheckpointIfNewer(checkpoint: AuditCheckpoint): Promise<void> {
  await redis.eval(ADVANCE_IF_NEWER_SCRIPT, 1, CHECKPOINT_KEY, JSON.stringify(checkpoint), checkpoint.id);
}

/**
 * The other half of the fix: never advance the checkpoint over evidence of tampering. Confirmed via
 * external security review that overwriting unconditionally had a second real problem beyond
 * ordering — if someone with Postgres access deletes the newest rows (moving the table's real state
 * behind what Redis last recorded), the very next legitimate append() would previously just
 * overwrite the checkpoint with ITS OWN new row, silently erasing the only evidence the truncation
 * ever happened. Before advancing, this re-checks that whatever was last checkpointed still
 * genuinely exists with a matching hash — if it doesn't, the checkpoint is left exactly where it
 * was (still correctly pointing at the last verified-good state, so a later verifyChain() still
 * catches the gap) and the violation is logged loudly. The new event itself is still recorded either
 * way — refusing to log at all because of unrelated historical tampering would turn a forensic
 * concern into an availability one.
 */
async function advanceCheckpoint(db: PrismaClient, next: AuditCheckpoint): Promise<void> {
  const current = await readCheckpoint();
  if (current) {
    const currentRow = await db.auditEvent.findUnique({ where: { id: BigInt(current.id) } });
    if (!currentRow || currentRow.eventHash !== current.eventHash) {
      console.error(
        `AUDIT CHAIN INTEGRITY VIOLATION: the checkpoint at audit_events.id=${current.id} no longer matches the database ` +
          `(${currentRow ? 'stored hash differs' : 'row is missing'}) — refusing to advance the checkpoint past this point. ` +
          `Investigate before trusting audit history; run verify-audit-chain. Event ${next.id} was still recorded normally.`
      );
      return;
    }
  }
  await writeCheckpointIfNewer(next);
}

export interface AuditEventInput {
  actorUserId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  requestId?: string;
  sourceIp?: string;
  details?: Record<string, unknown>;
}

export interface AuditChainFields {
  prevHash: string | null;
  occurredAt: Date;
  actorUserId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  requestId: string | null;
  sourceIpHash: string | null;
  details: unknown;
}

/**
 * Pure hash-chain function: audit_events.event_hash = sha256 of prevHash plus
 * every other column. Deliberately pure/exported so it can be unit tested and
 * reused identically by both append() and verifyChain() below.
 */
export function computeEventHash(fields: AuditChainFields): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        prevHash: fields.prevHash,
        occurredAt: fields.occurredAt.toISOString(),
        actorUserId: fields.actorUserId,
        eventType: fields.eventType,
        entityType: fields.entityType,
        entityId: fields.entityId,
        requestId: fields.requestId,
        sourceIpHash: fields.sourceIpHash,
        details: fields.details
      })
    )
    .digest('hex');
}

export interface ChainVerification {
  valid: boolean;
  brokenAtId: bigint | null;
  /**
   * 'verified' — the walk matches the independent Redis checkpoint exactly, the strong guarantee
   * this whole mechanism exists for. 'missing' — no checkpoint exists in Redis at all (a fresh
   * install with nothing appended yet, an existing deployment from before this feature shipped, or
   * Redis genuinely losing the key) — `valid` here reflects the internal-consistency check ALONE,
   * not the stronger independent one, and that distinction is surfaced explicitly rather than
   * silently reported as an equally-strong `valid: true`. 'mismatch' — a checkpoint exists but the
   * row it names is missing or altered (folded into `valid: false` already; kept here too so a
   * caller doesn't have to infer which failure mode occurred from `brokenAtId` alone).
   */
  checkpointStatus: 'verified' | 'missing' | 'mismatch';
}

export interface AuditQueryFilters {
  eventTypes?: string[];
  entityType?: string;
  from?: Date;
  to?: Date;
}

export function createAuditRepository(db: PrismaClient) {
  return {
    async append(input: AuditEventInput): Promise<AuditEvent> {
      const created = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;

        const [latest] = await tx.auditEvent.findMany({
          orderBy: { id: 'desc' },
          take: 1,
          select: { eventHash: true }
        });

        const prevHash = latest?.eventHash ?? null;
        const occurredAt = new Date();
        const actorUserId = input.actorUserId ?? null;
        const entityType = input.entityType ?? null;
        const entityId = input.entityId ?? null;
        const requestId = input.requestId ?? null;
        const sourceIpHash = input.sourceIp ? hashForAudit(input.sourceIp) : null;
        const details = input.details ?? {};

        const eventHash = computeEventHash({
          prevHash,
          occurredAt,
          actorUserId,
          eventType: input.eventType,
          entityType,
          entityId,
          requestId,
          sourceIpHash,
          details
        });

        return tx.auditEvent.create({
          data: {
            occurredAt,
            actorUserId,
            eventType: input.eventType,
            entityType,
            entityId,
            requestId,
            sourceIpHash,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: details as any,
            prevHash,
            eventHash
          }
        });
      });

      // Outside the Postgres transaction, deliberately — this is the point of a genuinely
      // independent checkpoint. Never lets a Redis-side failure here propagate out to the caller:
      // the authoritative record (the row itself) already committed to Postgres above, and a
      // synchronous audit call sits on real request paths (e.g. login) that must not break because
      // this best-effort, redundant copy couldn't be written this one time — the next successful
      // append's own advanceCheckpoint call catches it up, which only narrows (never defeats) what
      // verifyChain() can detect.
      try {
        await advanceCheckpoint(db, { id: created.id.toString(), eventHash: created.eventHash });
      } catch (error) {
        console.error(`Failed to advance the audit chain checkpoint for event ${created.id}:`, error);
      }

      return created;
    },

    list(limit = 250): Promise<AuditEvent[]> {
      return db.auditEvent.findMany({ orderBy: { id: 'desc' }, take: limit });
    },

    /** Backs a case's (or any other entity's) "History" tab — served by idx_audit_entity_time, already on the schema for exactly this. */
    listForEntity(entityType: string, entityId: string, limit = 100): Promise<AuditEvent[]> {
      return db.auditEvent.findMany({ where: { entityType, entityId }, orderBy: { occurredAt: 'desc' }, take: limit });
    },

    /** Backs the full /audit page's search+filter+pagination — served by idx_audit_type_time when `eventTypes` is set. `to` is treated as inclusive of the whole day. */
    async query(filters: AuditQueryFilters, page: number, pageSize: number): Promise<{ rows: AuditEvent[]; total: number }> {
      const where = {
        ...(filters.eventTypes && filters.eventTypes.length ? { eventType: { in: filters.eventTypes } } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from || filters.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {})
              }
            }
          : {})
      };

      const [rows, total] = await Promise.all([
        db.auditEvent.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        db.auditEvent.count({ where })
      ]);

      return { rows, total };
    },

    /**
     * Walks the whole chain in insertion order recomputing each event_hash and comparing it (and
     * prev_hash linkage) against what's stored, THEN checks the result against the independent
     * Redis checkpoint (see its own doc comment above). That second check is what actually closes
     * the gap a pure internal-consistency walk has on its own: deleting the newest rows, or wiping
     * the table entirely, leaves whatever's left perfectly self-consistent — confirmed via external
     * security review that the previous version of this method reported `valid: true` for both.
     * Use this before trusting the audit log's tamper-evidence in production.
     */
    async verifyChain(): Promise<ChainVerification> {
      const rows = await db.auditEvent.findMany({ orderBy: { id: 'asc' } });
      const checkpoint = await readCheckpoint();

      let prevHash: string | null = null;
      let checkpointRow: AuditEvent | null = null;
      for (const row of rows) {
        const expected = computeEventHash({
          prevHash,
          occurredAt: row.occurredAt,
          actorUserId: row.actorUserId,
          eventType: row.eventType,
          entityType: row.entityType,
          entityId: row.entityId,
          requestId: row.requestId,
          sourceIpHash: row.sourceIpHash,
          details: row.details
        });
        if (row.prevHash !== prevHash || row.eventHash !== expected) {
          return { valid: false, brokenAtId: row.id, checkpointStatus: checkpoint ? 'mismatch' : 'missing' };
        }
        if (checkpoint && row.id.toString() === checkpoint.id) {
          checkpointRow = row;
        }
        prevHash = row.eventHash;
      }

      if (!checkpoint) {
        // Nothing to independently confirm against — a fresh install with nothing appended yet, an
        // existing deployment from before this feature shipped, or Redis genuinely losing the key.
        // Reported as its own explicit status rather than silently folded into a plain `valid: true`
        // — a caller needs to be able to tell "fully verified" from "internally consistent, but we
        // couldn't independently confirm it."
        return { valid: true, brokenAtId: null, checkpointStatus: 'missing' };
      }

      // The checkpoint names both the row the last successful append actually created AND the exact
      // hash it had. Checking only that a row with that id exists (not what this used to do) isn't
      // enough — confirmed via external security review that a fully rewritten, internally
      // self-consistent chain which happens to reuse the same id would sail through that weaker
      // check. Comparing the real hash here is what actually proves the row is the SAME one that
      // was checkpointed, not merely a same-numbered replacement.
      if (!checkpointRow || checkpointRow.eventHash !== checkpoint.eventHash) {
        return { valid: false, brokenAtId: BigInt(checkpoint.id), checkpointStatus: 'mismatch' };
      }

      return { valid: true, brokenAtId: null, checkpointStatus: 'verified' };
    }
  };
}

export const auditRepository = createAuditRepository(auditPrisma);
