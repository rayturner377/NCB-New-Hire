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

  it('listAll() excludes only soft-deleted offices, keeping inactive ones', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { medicalOffice: { findMany } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).listAll();

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  });

  it('setActive() flips the active flag', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'office_1', active: false });
    const db = { medicalOffice: { update } } as unknown as PrismaClient;

    const result = await createMedicalOfficesRepository(db).setActive('office_1', false);

    expect(update).toHaveBeenCalledWith({ where: { id: 'office_1' }, data: { active: false } });
    expect(result.active).toBe(false);
  });

  it('softDelete() sets deletedAt and clears active', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'office_1' });
    const db = { medicalOffice: { update } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).softDelete('office_1');

    expect(update).toHaveBeenCalledWith({ where: { id: 'office_1' }, data: { deletedAt: expect.any(Date), active: false } });
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

    await createMedicalOfficesRepository(db).create({
      id: 'office_1',
      name: 'City Medical Centre',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      email: ''
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'office_1',
        name: 'City Medical Centre',
        addressLine1: undefined,
        addressLine2: undefined,
        city: undefined,
        state: undefined,
        country: undefined,
        phone: undefined,
        email: undefined,
        defaultMedicalFee: 0
      }
    });
  });

  it('update() passes every field straight through, including an intentionally-cleared empty string', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'office_1' });
    const db = { medicalOffice: { update } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).update('office_1', {
      name: 'Renamed Centre',
      addressLine1: '',
      addressLine2: 'Suite 4',
      city: 'Kingston',
      state: 'St. Andrew',
      country: 'Jamaica',
      phone: '876-555-0100',
      email: 'front-desk@example.com',
      defaultMedicalFee: 45
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'office_1' },
      data: {
        name: 'Renamed Centre',
        addressLine1: '',
        addressLine2: 'Suite 4',
        city: 'Kingston',
        state: 'St. Andrew',
        country: 'Jamaica',
        phone: '876-555-0100',
        email: 'front-desk@example.com',
        defaultMedicalFee: 45
      }
    });
  });

  it('update() omits fields the patch never mentioned rather than clearing them', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'office_1' });
    const db = { medicalOffice: { update } } as unknown as PrismaClient;

    await createMedicalOfficesRepository(db).update('office_1', { name: 'Renamed Centre' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'office_1' },
      data: {
        name: 'Renamed Centre',
        addressLine1: undefined,
        addressLine2: undefined,
        city: undefined,
        state: undefined,
        country: undefined,
        phone: undefined,
        email: undefined,
        defaultMedicalFee: undefined
      }
    });
  });
});
