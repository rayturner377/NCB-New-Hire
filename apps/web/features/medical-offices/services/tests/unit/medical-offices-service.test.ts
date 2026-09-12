import { beforeEach, describe, expect, it, vi } from 'vitest';

const listActiveMock = vi.fn();
const findByIdMock = vi.fn();
const createMock = vi.fn();

vi.mock('@ncb/database', () => ({
  medicalOfficesRepository: {
    listActive: (...args: unknown[]) => listActiveMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
    create: (...args: unknown[]) => createMock(...args)
  }
}));

const { listActiveMedicalOffices, getMedicalOfficeById, createMedicalOffice } = await import('../../medical-offices-service');

describe('medical offices service', () => {
  beforeEach(() => {
    listActiveMock.mockReset();
    findByIdMock.mockReset();
    createMock.mockReset();
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

  it('createMedicalOffice() generates an id and passes the input through', async () => {
    createMock.mockResolvedValue({ id: 'generated-id', name: 'NCB Clinic' });

    await createMedicalOffice({ name: 'NCB Clinic', address: '', phone: '', email: '', defaultMedicalFee: 0 });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), name: 'NCB Clinic' }));
  });
});
