import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createRolePermissionsRepository } from '../../role-permissions.js';

describe('role permissions repository', () => {
  it('listAll() returns every stored role/permission row', async () => {
    const findMany = vi.fn().mockResolvedValue([{ role: 'reviewer', permission: 'medical_cases:list' }]);
    const db = { rolePermission: { findMany } } as unknown as PrismaClient;

    const rows = await createRolePermissionsRepository(db).listAll();

    expect(findMany).toHaveBeenCalledWith();
    expect(rows).toEqual([{ role: 'reviewer', permission: 'medical_cases:list' }]);
  });

  it("setForRole() atomically replaces a role's whole permission set", async () => {
    const deleteMany = vi.fn();
    const createMany = vi.fn();
    const transaction = vi.fn(async (ops: unknown[]) => ops);
    const db = { rolePermission: { deleteMany, createMany }, $transaction: transaction } as unknown as PrismaClient;

    await createRolePermissionsRepository(db).setForRole('reviewer', ['medical_cases:list', 'reports:view']);

    expect(deleteMany).toHaveBeenCalledWith({ where: { role: 'reviewer' } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { role: 'reviewer', permission: 'medical_cases:list' },
        { role: 'reviewer', permission: 'reports:view' }
      ]
    });
    expect(transaction).toHaveBeenCalled();
  });
});
