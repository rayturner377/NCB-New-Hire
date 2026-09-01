import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../generated/client/index.js';
import { createAuditRepository } from '../../audit.js';

/**
 * Requires DATABASE_URL to point at a real Postgres instance (see
 * docker-compose.yml + .env.example) with `npm run migrate:deploy -w @ncb/database`
 * already applied — ideally the ncb_medical_test database, not dev data.
 * Run with: npm run test:integration -w @ncb/database
 */
describe('audit repository (integration)', () => {
  const db = new PrismaClient();
  const repository = createAuditRepository(db);

  beforeAll(async () => {
    await db.auditEvent.deleteMany();
  });

  afterAll(async () => {
    await db.auditEvent.deleteMany();
    await db.$disconnect();
  });

  it('builds a verifiable chain across multiple appends', async () => {
    await repository.append({ eventType: 'login_success', actorUserId: 'user_1' });
    await repository.append({ eventType: 'candidate_created', entityType: 'candidate', entityId: 'cand_1' });
    await repository.append({ eventType: 'submission_created', entityType: 'submission', entityId: 'sub_1' });

    const result = await repository.verifyChain();
    expect(result.valid).toBe(true);
  });

  it('detects tampering performed directly against the database', async () => {
    await repository.append({ eventType: 'login_success' });
    const [event] = await db.auditEvent.findMany({ orderBy: { id: 'desc' }, take: 1 });

    await db.auditEvent.update({
      where: { id: event.id },
      data: { details: { tampered: true } }
    });

    const result = await repository.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(event.id);
  });
});
