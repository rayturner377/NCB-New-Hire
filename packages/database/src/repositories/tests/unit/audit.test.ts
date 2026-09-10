import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { computeEventHash, createAuditRepository } from '../../audit.js';

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
  it('append() chains off the most recent event_hash', async () => {
    const db = {
      $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
      auditEvent: {}
    } as unknown as PrismaClient;

    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([{ eventHash: 'previous-hash' }]),
        create: vi.fn().mockImplementation(({ data }: { data: { prevHash: string | null } }) =>
          Promise.resolve(data)
        )
      }
    };
    (db as unknown as { $transaction: unknown }).$transaction = vi.fn((callback: (tx: unknown) => unknown) =>
      callback(tx)
    );

    const repository = createAuditRepository(db);
    const created = (await repository.append({ eventType: 'login_success' })) as unknown as {
      prevHash: string | null;
    };

    expect(created.prevHash).toBe('previous-hash');
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('verifyChain() detects a tampered row', async () => {
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

  it('verifyChain() accepts an untampered chain', async () => {
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

    const db = {
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([first])
      }
    } as unknown as PrismaClient;

    const repository = createAuditRepository(db);
    const result = await repository.verifyChain();

    expect(result).toEqual({ valid: true, brokenAtId: null });
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
});
