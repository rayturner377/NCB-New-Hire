import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const listAll = vi.fn();
const findById = vi.fn();
const transition = vi.fn();

vi.mock('@ncb/database', () => ({
  casesRepository: {
    create: (...args: unknown[]) => create(...args),
    listAll: (...args: unknown[]) => listAll(...args),
    findById: (...args: unknown[]) => findById(...args),
    transition: (...args: unknown[]) => transition(...args)
  }
}));

const masterKey = randomBytes(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));

const { createCase, getCaseById, listCases, transitionCase } = await import('../../cases-service');

describe('cases service', () => {
  beforeEach(() => {
    create.mockReset();
    listAll.mockReset();
    findById.mockReset();
    transition.mockReset();
  });

  it('createCase routes to sent_to_patient for the patient route', async () => {
    create.mockResolvedValue({ id: 'case_1' });

    await createCase({ patientId: 'cand_1', route: 'patient', createdBy: 'usr_reviewer_demo' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'cand_1', route: 'patient', status: 'sent_to_patient' }),
      masterKey
    );
  });

  it('createCase routes to sent_to_doctor for the doctor route', async () => {
    create.mockResolvedValue({ id: 'case_1' });

    await createCase({
      patientId: 'cand_1',
      route: 'doctor',
      assignedClinicianId: 'usr_doctor_demo',
      createdBy: 'usr_reviewer_demo'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent_to_doctor', assignedClinicianId: 'usr_doctor_demo' }),
      masterKey
    );
  });

  it('listCases passes the master key through', async () => {
    listAll.mockResolvedValue([]);
    await listCases();
    expect(listAll).toHaveBeenCalledWith(masterKey);
  });

  it('getCaseById passes the master key through', async () => {
    findById.mockResolvedValue(null);
    await getCaseById('case_1');
    expect(findById).toHaveBeenCalledWith('case_1', masterKey);
  });

  it('transitionCase forwards to the repository as-is', async () => {
    transition.mockResolvedValue(2);
    const result = await transitionCase('case_1', 1, 'reviewed', 'usr_reviewer_demo');
    expect(transition).toHaveBeenCalledWith('case_1', 1, 'reviewed', 'usr_reviewer_demo');
    expect(result).toBe(2);
  });
});
