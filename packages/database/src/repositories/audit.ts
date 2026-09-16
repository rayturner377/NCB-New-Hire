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

async function writeCheckpoint(checkpoint: AuditCheckpoint): Promise<void> {
  await redis.set(CHECKPOINT_KEY, JSON.stringify(checkpoint));
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
      // independent checkpoint. The advisory lock held above already serializes appends against
      // each other, so writes here happen in the same order the rows themselves were created; a
      // crash between the transaction committing and this line just means the checkpoint lags
      // behind by one event until the next successful append catches it up, which only narrows
      // (never defeats) what verifyChain() can detect.
      await writeCheckpoint({ id: created.id.toString(), eventHash: created.eventHash });

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
      let checkpointRowFound = false;
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
          return { valid: false, brokenAtId: row.id };
        }
        if (checkpoint && row.id.toString() === checkpoint.id) {
          checkpointRowFound = true;
        }
        prevHash = row.eventHash;
      }

      // The checkpoint names the row the last successful append actually created. If it's not
      // among what we just walked — whether the table is now completely empty or merely missing
      // that one row — every row at or after it was deleted, no matter how clean the remaining
      // chain looks. (If Redis itself has lost the checkpoint — e.g. flushed — this can only fall
      // back to the pure internal-consistency check above; the checkpoint's protection is only as
      // strong as the isolation between the two stores.)
      if (checkpoint && !checkpointRowFound) {
        return { valid: false, brokenAtId: BigInt(checkpoint.id) };
      }

      return { valid: true, brokenAtId: null };
    }
  };
}

export const auditRepository = createAuditRepository(auditPrisma);
