import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';

const redisGetMock = vi.fn();
const redisEvalMock = vi.fn();

vi.mock('@ncb/redis', () => ({
  redis: {
    get: (...args: unknown[]) => redisGetMock(...args),
    eval: (...args: unknown[]) => redisEvalMock(...args)
  }
}));

const { computeEventHash, createAuditRepository } = await import('../../audit.js');

describe('computeEventHash', () => {
  it('is deterministic for the same fields', () => {
    const fields = {
      prevHash: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      actorUserId: 'user_1',
      eventType: 'login_failed',
      entityType: null,
      entityId: null,
      requestId: 'req_1',
      sourceIpHash: 'abc',
      details: { emailHash: 'xyz' }
    };
    expect(computeEventHash(fields)).toBe(computeEventHash({ ...fields }));
  });

  it('changes when prevHash changes, chaining the event to its predecessor', () => {
    const fields = {
      prevHash: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      actorUserId: null,
      eventType: 'login_failed',
      entityType: null,
      entityId: null,
      requestId: null,
      sourceIpHash: null,
      details: {}
    };
    const a = computeEventHash(fields);
    const b = computeEventHash({ ...fields, prevHash: 'some-other-hash' });
    expect(a).not.toBe(b);
  });
});

/** A fake row shaped like a real audit_events row, with its eventHash actually computed rather than hardcoded — reused across several tests below. */
function makeRow(overrides: Partial<Record<string, unknown>> & { id: bigint; prevHash: string | null }) {
  const base = {
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    actorUserId: null,
    eventType: 'login_success',
    entityType: null,
    entityId: null,
    requestId: null,
    sourceIpHash: null,
    details: {},
    ...overrides
  };
  return { ...base, eventHash: computeEventHash(base as never) };
}

describe('audit repository', () => {
  beforeEach(() => {
    redisGetMock.mockReset();
    redisEvalMock.mockReset();
    redisGetMock.mockResolvedValue(null);
    redisEvalMock.mockResolvedValue(1);
  });

  describe('append()', () => {
    function fakeDb(overrides: { latestHash?: string; findUniqueResult?: unknown } = {}) {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        auditEvent: {
          findMany: vi.fn().mockResolvedValue(overrides.latestHash ? [{ eventHash: overrides.latestHash }] : []),
          create: vi.fn().mockImplementation(({ data }: { data: { prevHash: string | null; eventHash: string } }) =>
            Promise.resolve({ id: 5n, ...data })
          )
        }
      };
      const findUnique = vi.fn().mockResolvedValue(overrides.findUniqueResult ?? null);
      const db = {
        $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
        auditEvent: { findUnique }
      } as unknown as PrismaClient;
      return { db, tx, findUnique };
    }

    it('chains off the most recent event_hash', async () => {
      const { db, tx } = fakeDb({ latestHash: 'previous-hash' });

      const repository = createAuditRepository(db);
      const created = (await repository.append({ eventType: 'login_success' })) as unknown as { prevHash: string | null };

      expect(created.prevHash).toBe('previous-hash');
      expect(tx.$executeRaw).toHaveBeenCalled();
    });

    it('advances the checkpoint via the atomic newer-only script when nothing was checkpointed yet', async () => {
      const { db, findUnique } = fakeDb();

      const created = (await createAuditRepository(db).append({ eventType: 'login_success' })) as unknown as {
        id: bigint;
        eventHash: string;
      };

      expect(findUnique).not.toHaveBeenCalled();
      expect(redisEvalMock).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'audit:chain-checkpoint',
        JSON.stringify({ id: '5', eventHash: created.eventHash }),
        '5'
      );
    });

    it('checks the previous checkpoint still holds before advancing to the new one', async () => {
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '4', eventHash: 'prior-checkpoint-hash' }));
      const { db, findUnique } = fakeDb({ findUniqueResult: { id: 4n, eventHash: 'prior-checkpoint-hash' } });

      await createAuditRepository(db).append({ eventType: 'login_success' });

      expect(findUnique).toHaveBeenCalledWith({ where: { id: 4n } });
      expect(redisEvalMock).toHaveBeenCalled();
    });

    it('refuses to advance the checkpoint — without failing the append itself — when the previously checkpointed row no longer matches', async () => {
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '4', eventHash: 'prior-checkpoint-hash' }));
      // Row 4 still exists but its hash no longer matches what was checkpointed — someone altered it.
      const { db } = fakeDb({ findUniqueResult: { id: 4n, eventHash: 'a-different-hash-now' } });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await createAuditRepository(db).append({ eventType: 'login_success' });

      expect(result).toBeTruthy(); // the new event is still recorded
      expect(redisEvalMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('AUDIT CHAIN INTEGRITY VIOLATION'));
    });

    it('refuses to advance the checkpoint when the previously checkpointed row was deleted entirely', async () => {
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '4', eventHash: 'prior-checkpoint-hash' }));
      const { db } = fakeDb({ findUniqueResult: null });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await createAuditRepository(db).append({ eventType: 'login_success' });

      expect(redisEvalMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('row is missing'));
    });

    it('never lets a Redis failure while advancing the checkpoint break the append itself', async () => {
      redisEvalMock.mockRejectedValue(new Error('Redis connection refused'));
      const { db } = fakeDb();
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createAuditRepository(db).append({ eventType: 'login_success' })).resolves.toBeTruthy();
    });
  });

  describe('verifyChain()', () => {
    it('detects a tampered row independent of any checkpoint', async () => {
      const first = makeRow({ id: 1n, prevHash: null });
      const second = makeRow({ id: 2n, prevHash: first.eventHash, eventType: 'submission_created', entityType: 'submission', entityId: 'sub_1' });

      const db = {
        auditEvent: { findMany: vi.fn().mockResolvedValue([first, { ...second, details: { tampered: true } }]) }
      } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe(2n);
    });

    it('reports checkpointStatus "verified" for an untampered chain whose checkpoint hash matches exactly', async () => {
      const first = makeRow({ id: 1n, prevHash: null });
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '1', eventHash: first.eventHash }));

      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([first]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: true, brokenAtId: null, checkpointStatus: 'verified' });
    });

    it('reports checkpointStatus "missing" (not silently "verified") for an internally-consistent chain with no checkpoint recorded', async () => {
      const first = makeRow({ id: 1n, prevHash: null });
      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([first]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: true, brokenAtId: null, checkpointStatus: 'missing' });
    });

    it('reports checkpointStatus "missing" for a genuinely empty, never-appended-to chain', async () => {
      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: true, brokenAtId: null, checkpointStatus: 'missing' });
    });

    it('rejects a completely wiped table when a checkpoint says events used to exist', async () => {
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '7', eventHash: 'some-real-hash' }));
      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: false, brokenAtId: 7n, checkpointStatus: 'mismatch' });
    });

    it('rejects a chain with its newest events deleted, even though the remaining rows are perfectly self-consistent', async () => {
      const first = makeRow({ id: 1n, prevHash: null });
      // The checkpoint remembers a row 2 that no longer exists — exactly what deleting the tail after
      // the checkpoint was written looks like from Redis's independent point of view.
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '2', eventHash: 'hash-of-the-deleted-row' }));

      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([first]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: false, brokenAtId: 2n, checkpointStatus: 'mismatch' });
    });

    it('rejects a fully rewritten but internally-consistent chain that reuses the checkpointed row id with different content — the exact gap a plain "does this id exist" check missed', async () => {
      // A fabricated row 1 — perfectly self-consistent on its own (its own hash matches its own
      // content), but it is NOT the row that was actually checkpointed (different content entirely).
      const fabricatedFirst = makeRow({ id: 1n, prevHash: null, eventType: 'fabricated_event' });
      redisGetMock.mockResolvedValue(JSON.stringify({ id: '1', eventHash: 'the-real-original-hash-not-this-one' }));

      const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([fabricatedFirst]) } } as unknown as PrismaClient;

      const result = await createAuditRepository(db).verifyChain();

      expect(result).toEqual({ valid: false, brokenAtId: 1n, checkpointStatus: 'mismatch' });
    });
  });

  describe('query()', () => {
    it('builds a where clause from eventTypes/entityType/from/to and paginates via skip/take', async () => {
      const findMany = vi.fn().mockResolvedValue([{ id: 1n }]);
      const count = vi.fn().mockResolvedValue(1);
      const db = { auditEvent: { findMany, count } } as unknown as PrismaClient;

      const repository = createAuditRepository(db);
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-31T23:59:59.999Z');
      const result = await repository.query({ eventTypes: ['user_created', 'user_deleted'], entityType: 'user', from, to }, 2, 25);

      expect(findMany).toHaveBeenCalledWith({
        where: { eventType: { in: ['user_created', 'user_deleted'] }, entityType: 'user', occurredAt: { gte: from, lte: to } },
        orderBy: { occurredAt: 'desc' },
        skip: 25,
        take: 25
      });
      expect(count).toHaveBeenCalledWith({ where: { eventType: { in: ['user_created', 'user_deleted'] }, entityType: 'user', occurredAt: { gte: from, lte: to } } });
      expect(result).toEqual({ rows: [{ id: 1n }], total: 1 });
    });

    it('omits filters that were not provided', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const db = { auditEvent: { findMany, count } } as unknown as PrismaClient;

      const repository = createAuditRepository(db);
      await repository.query({}, 1, 10);

      expect(findMany).toHaveBeenCalledWith({ where: {}, orderBy: { occurredAt: 'desc' }, skip: 0, take: 10 });
    });
  });

  it('list() defaults to the most recent 250 events', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { auditEvent: { findMany } } as unknown as PrismaClient;

    await createAuditRepository(db).list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { id: 'desc' }, take: 250 });
  });

  it('list() respects an explicit limit', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { auditEvent: { findMany } } as unknown as PrismaClient;

    await createAuditRepository(db).list(10);

    expect(findMany).toHaveBeenCalledWith({ orderBy: { id: 'desc' }, take: 10 });
  });

  it("listForEntity() scopes to one entity's own events, newest first", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { auditEvent: { findMany } } as unknown as PrismaClient;

    await createAuditRepository(db).listForEntity('case', 'case_1');

    expect(findMany).toHaveBeenCalledWith({
      where: { entityType: 'case', entityId: 'case_1' },
      orderBy: { occurredAt: 'desc' },
      take: 100
    });
  });
});
