import { createHash } from 'node:crypto';
import { hashForAudit } from '@ncb/shared';
import type { AuditEvent, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

// Arbitrary fixed key for the Postgres session-level advisory lock that
// serializes audit-chain writes (same locking primitive database/index.js
// already used for migrations), so two concurrent appends can't compute the
// same prevHash.
const ADVISORY_LOCK_KEY = 872_346_501;

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
      return db.$transaction(async (tx) => {
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
     * Walks the whole chain in insertion order recomputing each event_hash and
     * comparing it (and prev_hash linkage) against what's stored. Use this
     * before trusting the audit log's tamper-evidence in production.
     */
    async verifyChain(): Promise<ChainVerification> {
      const rows = await db.auditEvent.findMany({ orderBy: { id: 'asc' } });
      let prevHash: string | null = null;
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
        prevHash = row.eventHash;
      }
      return { valid: true, brokenAtId: null };
    }
  };
}

export const auditRepository = createAuditRepository(prisma);
