import { beforeEach, describe, expect, it, vi } from 'vitest';

const listActiveMock = vi.fn();
const findByIdMock = vi.fn();
const createMock = vi.fn();
const auditAppendMock = vi.fn();

vi.mock('@ncb/database', () => ({
  medicalOfficesRepository: {
    listActive: (...args: unknown[]) => listActiveMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
    create: (...args: unknown[]) => createMock(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppendMock(...args)
  }
}));

const { listActiveMedicalOffices, getMedicalOfficeById, createMedicalOffice } = await import('../../medical-offices-service');

describe('medical offices service', () => {
  beforeEach(() => {
    listActiveMock.mockReset();
    findByIdMock.mockReset();
    createMock.mockReset();
    auditAppendMock.mockReset();
  });

  it('listActiveMedicalOffices() delegates to the repository', async () => {
    listActiveMock.mockResolvedValue([{ id: 'office_1' }]);
    expect(await listActiveMedicalOffices()).toEqual([{ id: 'office_1' }]);
  });

  it('getMedicalOfficeById() delegates to the repository', async () => {
    findByIdMock.mockResolvedValue({ id: 'office_1' });
    expect(await getMedicalOfficeById('office_1')).toEqual({ id: 'office_1' });
    expect(findByIdMock).toHaveBeenCalledWith('office_1');
  });

  it('createMedicalOffice() generates an id, passes the input through, and audits it', async () => {
    createMock.mockResolvedValue({ id: 'generated-id', name: 'NCB Clinic' });

    await createMedicalOffice({ name: 'NCB Clinic', address: '', phone: '', email: '', defaultMedicalFee: 0 }, 'usr_admin_demo');

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), name: 'NCB Clinic' }));
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'medical_office_created', actorUserId: 'usr_admin_demo', details: { name: 'NCB Clinic' } })
    );
  });
});
