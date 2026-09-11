import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createMedicalOfficesRepository } from '../../medical-offices.js';

describe('medical offices repository', () => {
  it('listActive() excludes soft-deleted/inactive offices, ordered by name', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { medicalOffice: { findMany } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).listActive();

    expect(findMany).toHaveBeenCalledWith({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } });
  });

  it('findById() looks up a single non-deleted office', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'office_1' });
    const db = { medicalOffice: { findFirst } } as unknown as PrismaClient;

    const found = await createMedicalOfficesRepository(db).findById('office_1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'office_1', deletedAt: null } });
    expect(found?.id).toBe('office_1');
  });

  it('create() defaults an omitted rate to 0 and drops blank optional fields', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'office_1' });
    const db = { medicalOffice: { create } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).create({ id: 'office_1', name: 'City Medical Centre', address: '', phone: '', email: '' });

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'office_1',
        name: 'City Medical Centre',
        address: undefined,
        phone: undefined,
        email: undefined,
        defaultMedicalFee: 0
      }
    });
  });
});
