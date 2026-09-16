import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';

const redisGetMock = vi.fn();
const redisSetMock = vi.fn();

vi.mock('@ncb/redis', () => ({
  redis: {
    get: (...args: unknown[]) => redisGetMock(...args),
    set: (...args: unknown[]) => redisSetMock(...args)
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

describe('audit repository', () => {
  beforeEach(() => {
    redisGetMock.mockReset();
    redisSetMock.mockReset();
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue('OK');
  });

  it('append() chains off the most recent event_hash and writes an independent Redis checkpoint', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([{ eventHash: 'previous-hash' }]),
        create: vi.fn().mockImplementation(({ data }: { data: { prevHash: string | null; eventHash: string } }) =>
          Promise.resolve({ id: 5n, ...data })
        )
      }
    };
    const db = {
      $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      auditEvent: {}
    } as unknown as PrismaClient;

    const repository = createAuditRepository(db);
    const created = (await repository.append({ eventType: 'login_success' })) as unknown as {
      id: bigint;
      prevHash: string | null;
      eventHash: string;
    };

    expect(created.prevHash).toBe('previous-hash');
    expect(tx.$executeRaw).toHaveBeenCalled();
    // The checkpoint is a plain JSON string of {id, eventHash} — id serialized since BigInt isn't
    // JSON-serializable directly (see writeCheckpoint's own reasoning in audit.ts).
    expect(redisSetMock).toHaveBeenCalledWith('audit:chain-checkpoint', JSON.stringify({ id: '5', eventHash: created.eventHash }));
  });

  it('verifyChain() detects a tampered row (independent of the checkpoint)', async () => {
    const first = {
      id: 1n,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      actorUserId: null,
      eventType: 'login_success',
      entityType: null,
      entityId: null,
      requestId: null,
      sourceIpHash: null,
      details: {},
      prevHash: null,
      eventHash: ''
    };
    first.eventHash = computeEventHash({ ...first });

    const second = {
      id: 2n,
      occurredAt: new Date('2026-01-01T00:05:00.000Z'),
      actorUserId: null,
      eventType: 'submission_created',
      entityType: 'submission',
      entityId: 'sub_1',
      requestId: null,
      sourceIpHash: null,
      details: { tampered: true },
      prevHash: first.eventHash,
      eventHash: ''
    };
    second.eventHash = computeEventHash({ ...second });

    const db = {
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([first, { ...second, details: { tampered: false } }])
      }
    } as unknown as PrismaClient;

    const repository = createAuditRepository(db);
    const result = await repository.verifyChain();

    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(2n);
  });

  it('verifyChain() accepts an untampered chain that matches the checkpoint', async () => {
    const first = {
      id: 1n,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      actorUserId: null,
      eventType: 'login_success',
      entityType: null,
      entityId: null,
      requestId: null,
      sourceIpHash: null,
      details: {},
      prevHash: null,
      eventHash: ''
    };
    first.eventHash = computeEventHash({ ...first });
    redisGetMock.mockResolvedValue(JSON.stringify({ id: '1', eventHash: first.eventHash }));

    const db = {
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([first])
      }
    } as unknown as PrismaClient;

    const repository = createAuditRepository(db);
    const result = await repository.verifyChain();

    expect(result).toEqual({ valid: true, brokenAtId: null });
  });

  it('verifyChain() accepts an empty chain only when no checkpoint has ever been recorded', async () => {
    const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient;

    const result = await createAuditRepository(db).verifyChain();

    expect(result).toEqual({ valid: true, brokenAtId: null });
  });

  it('verifyChain() rejects a completely wiped table when a checkpoint says events used to exist — closes the "empty chain looks valid" gap', async () => {
    redisGetMock.mockResolvedValue(JSON.stringify({ id: '7', eventHash: 'some-real-hash' }));
    const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient;

    const result = await createAuditRepository(db).verifyChain();

    expect(result).toEqual({ valid: false, brokenAtId: 7n });
  });

  it('verifyChain() rejects a chain with its newest events deleted, even though the remaining rows are perfectly self-consistent', async () => {
    const first = {
      id: 1n,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      actorUserId: null,
      eventType: 'login_success',
      entityType: null,
      entityId: null,
      requestId: null,
      sourceIpHash: null,
      details: {},
      prevHash: null,
      eventHash: ''
    };
    first.eventHash = computeEventHash({ ...first });
    // The checkpoint remembers a row 2 that no longer exists — exactly what deleting the tail after
    // the checkpoint was written looks like from Redis's independent point of view.
    redisGetMock.mockResolvedValue(JSON.stringify({ id: '2', eventHash: 'hash-of-the-deleted-row' }));

    const db = { auditEvent: { findMany: vi.fn().mockResolvedValue([first]) } } as unknown as PrismaClient;

    const result = await createAuditRepository(db).verifyChain();

    expect(result).toEqual({ valid: false, brokenAtId: 2n });
  });

  it('query() builds a where clause from eventTypes/entityType/from/to and paginates via skip/take', async () => {
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

  it('query() omits filters that were not provided', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = { auditEvent: { findMany, count } } as unknown as PrismaClient;

    const repository = createAuditRepository(db);
    await repository.query({}, 1, 10);

    expect(findMany).toHaveBeenCalledWith({ where: {}, orderBy: { occurredAt: 'desc' }, skip: 0, take: 10 });
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
