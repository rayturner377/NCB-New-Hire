import { beforeEach, describe, expect, it, vi } from 'vitest';

const listActiveMock = vi.fn();
const listAllMock = vi.fn();
const findByIdMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const setActiveMock = vi.fn();
const softDeleteMock = vi.fn();
const auditAppendMock = vi.fn();

vi.mock('@ncb/database', () => ({
  medicalOfficesRepository: {
    listActive: (...args: unknown[]) => listActiveMock(...args),
    listAll: (...args: unknown[]) => listAllMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    setActive: (...args: unknown[]) => setActiveMock(...args),
    softDelete: (...args: unknown[]) => softDeleteMock(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppendMock(...args)
  }
}));

const {
  listActiveMedicalOffices,
  listAllMedicalOffices,
  listActiveMedicalOfficeOptions,
  getMedicalOfficeById,
  createMedicalOffice,
  updateMedicalOffice,
  setMedicalOfficeActive,
  deleteMedicalOffice
} = await import('../../medical-offices-service');

describe('medical offices service', () => {
  beforeEach(() => {
    listActiveMock.mockReset();
    listAllMock.mockReset();
    findByIdMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    setActiveMock.mockReset();
    softDeleteMock.mockReset();
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

    await createMedicalOffice(
      { name: 'NCB Clinic', addressLine1: '', addressLine2: '', city: '', state: '', country: '', phone: '', email: '', defaultMedicalFee: 0 },
      'usr_admin_demo'
    );

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), name: 'NCB Clinic' }));
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'medical_office_created', actorUserId: 'usr_admin_demo', details: { name: 'NCB Clinic' } })
    );
  });

  it('listActiveMedicalOfficeOptions() projects each office down to id/name/address, joining the 5 stored parts into one line', async () => {
    listActiveMock.mockResolvedValue([
      {
        id: 'office_1',
        name: 'NCB Clinic',
        addressLine1: '123 Main St',
        addressLine2: '',
        city: 'Kingston',
        state: null,
        country: 'Jamaica',
        defaultMedicalFee: { toString: () => '45' }
      }
    ]);

    expect(await listActiveMedicalOfficeOptions()).toEqual([
      { id: 'office_1', name: 'NCB Clinic', address: '123 Main St, Kingston, Jamaica' }
    ]);
  });

  it('listActiveMedicalOfficeOptions() gives a null address when every part is blank', async () => {
    listActiveMock.mockResolvedValue([
      { id: 'office_1', name: 'NCB Clinic', addressLine1: null, addressLine2: null, city: null, state: null, country: null }
    ]);

    expect(await listActiveMedicalOfficeOptions()).toEqual([{ id: 'office_1', name: 'NCB Clinic', address: null }]);
  });

  it('updateMedicalOffice() passes the patch through and audits it', async () => {
    updateMock.mockResolvedValue({ id: 'office_1', name: 'Renamed Clinic' });

    await updateMedicalOffice(
      'office_1',
      { name: 'Renamed Clinic', addressLine1: '', addressLine2: '', city: '', state: '', country: '', phone: '', email: '', defaultMedicalFee: 50 },
      'usr_admin_demo'
    );

    expect(updateMock).toHaveBeenCalledWith('office_1', {
      name: 'Renamed Clinic',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      email: '',
      defaultMedicalFee: 50
    });
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'medical_office_updated', actorUserId: 'usr_admin_demo', entityId: 'office_1', details: { name: 'Renamed Clinic' } })
    );
  });

  it('listAllMedicalOffices() delegates to the repository', async () => {
    listAllMock.mockResolvedValue([{ id: 'office_1' }, { id: 'office_2', active: false }]);
    expect(await listAllMedicalOffices()).toEqual([{ id: 'office_1' }, { id: 'office_2', active: false }]);
  });

  it('setMedicalOfficeActive() toggles active state and audits with the right event type', async () => {
    setActiveMock.mockResolvedValue({ id: 'office_1', name: 'NCB Clinic', active: false });

    const result = await setMedicalOfficeActive('office_1', false, 'usr_admin_demo');

    expect(setActiveMock).toHaveBeenCalledWith('office_1', false);
    expect(result.active).toBe(false);
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'medical_office_deactivated', actorUserId: 'usr_admin_demo', entityId: 'office_1', details: { name: 'NCB Clinic' } })
    );
  });

  it('setMedicalOfficeActive(true) audits as activated', async () => {
    setActiveMock.mockResolvedValue({ id: 'office_1', name: 'NCB Clinic', active: true });

    await setMedicalOfficeActive('office_1', true, 'usr_admin_demo');

    expect(auditAppendMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'medical_office_activated' }));
  });

  it('deleteMedicalOffice() soft-deletes and audits with the pre-deletion name', async () => {
    softDeleteMock.mockResolvedValue({ id: 'office_1', name: 'City Medical Centre' });

    await deleteMedicalOffice('office_1', 'usr_admin_demo');

    expect(softDeleteMock).toHaveBeenCalledWith('office_1');
    expect(auditAppendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'medical_office_deleted',
        actorUserId: 'usr_admin_demo',
        entityId: 'office_1',
        details: { name: 'City Medical Centre' }
      })
    );
  });
});
