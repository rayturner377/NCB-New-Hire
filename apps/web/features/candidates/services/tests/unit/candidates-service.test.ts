import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CandidatePayload } from '../../../types';

const save = vi.fn();
const listAll = vi.fn();
const listForUser = vi.fn();
const findById = vi.fn();
const auditAppend = vi.fn();

vi.mock('@ncb/database', () => ({
  candidatesRepository: {
    save: (...args: unknown[]) => save(...args),
    listAll: (...args: unknown[]) => listAll(...args),
    listForUser: (...args: unknown[]) => listForUser(...args),
    findById: (...args: unknown[]) => findById(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppend(...args)
  }
}));

const masterKey = randomBytes(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));

const createUser = vi.fn();
vi.mock('../../../../users/services/users-service', () => ({
  createUser: (...args: unknown[]) => createUser(...args)
}));

const { createCandidate, getCandidateById, listCandidates, listCandidatesForUser, updateCandidate } = await import(
  '../../candidates-service'
);

function samplePayload(overrides: Partial<CandidatePayload> = {}): CandidatePayload {
  return {
    id: 'cand_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'usr_reviewer_demo',
    createdByName: 'Demo Reviewer',
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedClinicianId: '',
    assignedClinicianName: '',
    status: 'assigned',
    withdrawalReason: '',
    submittedAt: '',
    submissionId: '',
    fullName: 'Jane Doe',
    employeeId: 'EMP-1',
    nationalId: '',
    dateOfBirth: '1990-01-01',
    email: '',
    contactNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    primaryPhysicianName: '',
    primaryPhysicianNumber: '',
    position: 'Teller',
    medicationInformation: '',
    ...overrides
  };
}

describe('candidates service', () => {
  beforeEach(() => {
    save.mockReset();
    listAll.mockReset();
    listForUser.mockReset();
    findById.mockReset();
    createUser.mockReset();
    auditAppend.mockReset();
  });

  it('createCandidate builds the full payload and persists it', async () => {
    save.mockResolvedValue(undefined);

    const created = await createCandidate({
      fullName: 'Jane Doe',
      position: 'Teller',
      dateOfBirth: '1990-01-01',
      createdBy: 'usr_reviewer_demo',
      createdByName: 'Demo Reviewer'
    });

    expect(created.status).toBe('assigned');
    expect(created.id).toMatch(/^cand_/);
    expect(created.linkedUserId).toBe('');
    expect(createUser).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id, fullName: 'Jane Doe' }),
      masterKey
    );
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'candidate_created', actorUserId: 'usr_reviewer_demo', entityId: created.id })
    );
  });

  it('createCandidate grants portal access when checked and an email is present, linking the new account', async () => {
    save.mockResolvedValue(undefined);
    createUser.mockResolvedValue({ id: 'usr_new_patient' });

    const created = await createCandidate({
      fullName: 'Jane Doe',
      position: 'Teller',
      dateOfBirth: '1990-01-01',
      email: 'jane@example.com',
      grantPortalAccess: true,
      createdBy: 'usr_reviewer_demo',
      createdByName: 'Demo Reviewer'
    });

    expect(createUser).toHaveBeenCalledWith({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      role: 'patient',
      activationCodeTtlMs: undefined
    });
    expect(created.linkedUserId).toBe('usr_new_patient');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ linkedUserId: 'usr_new_patient' }), masterKey);
  });

  it('createCandidate does not grant portal access when checked but no email is given', async () => {
    save.mockResolvedValue(undefined);

    const created = await createCandidate({
      fullName: 'Jane Doe',
      position: 'Teller',
      dateOfBirth: '1990-01-01',
      grantPortalAccess: true,
      createdBy: 'usr_reviewer_demo',
      createdByName: 'Demo Reviewer'
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(created.linkedUserId).toBe('');
  });

  it('createCandidate forwards an admin-chosen activationCodeTtlMs through to createUser', async () => {
    save.mockResolvedValue(undefined);
    createUser.mockResolvedValue({ id: 'usr_new_patient' });

    await createCandidate({
      fullName: 'Jane Doe',
      position: 'Teller',
      dateOfBirth: '1990-01-01',
      email: 'jane@example.com',
      grantPortalAccess: true,
      activationCodeTtlMs: 60 * 60 * 1000,
      createdBy: 'usr_reviewer_demo',
      createdByName: 'Demo Reviewer'
    });

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ activationCodeTtlMs: 60 * 60 * 1000 }));
  });

  it('listCandidates filters out rows with no payload', async () => {
    listAll.mockResolvedValue([{ payload: samplePayload() }, { payload: null }]);

    const result = await listCandidates();

    expect(result).toHaveLength(1);
    expect(listAll).toHaveBeenCalledWith(masterKey);
  });

  it('listCandidatesForUser scopes to the linked user', async () => {
    listForUser.mockResolvedValue([{ payload: samplePayload() }]);

    await listCandidatesForUser('usr_doctor_demo');

    expect(listForUser).toHaveBeenCalledWith('usr_doctor_demo', masterKey);
  });

  it('getCandidateById returns null when nothing is found', async () => {
    findById.mockResolvedValue(null);
    expect(await getCandidateById('missing')).toBeNull();
  });

  it('updateCandidate throws when the candidate does not exist', async () => {
    findById.mockResolvedValue(null);
    await expect(updateCandidate('missing', { fullName: 'New Name' }, 'usr_reviewer_demo')).rejects.toThrow('Candidate not found');
  });

  it('updateCandidate merges the patch and resets a withdrawn status on reassignment', async () => {
    findById.mockResolvedValue({ payload: samplePayload({ status: 'withdrawn' }) });
    save.mockResolvedValue(undefined);

    const updated = await updateCandidate(
      'cand_1',
      { assignedClinicianId: 'usr_doctor_demo', assignedClinicianName: 'Demo Doctor' },
      'usr_reviewer_demo'
    );

    expect(updated.status).toBe('assigned');
    expect(updated.assignedClinicianId).toBe('usr_doctor_demo');
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'candidate_updated', actorUserId: 'usr_reviewer_demo', entityId: 'cand_1' })
    );
  });

  it('updateCandidate applies an explicit status change as-is', async () => {
    findById.mockResolvedValue({ payload: samplePayload() });
    save.mockResolvedValue(undefined);

    const updated = await updateCandidate('cand_1', { status: 'archived' }, 'usr_reviewer_demo');

    expect(updated.status).toBe('archived');
  });

  it('updateCandidate patches every field when all are provided at once', async () => {
    findById.mockResolvedValue({ payload: samplePayload() });
    save.mockResolvedValue(undefined);

    const patch = {
      fullName: 'New Name',
      employeeId: 'EMP-2',
      nationalId: 'NID-1',
      dateOfBirth: '1991-02-02',
      email: 'new@example.com',
      contactNumber: '+18760000000',
      addressLine1: '1 New St',
      addressLine2: 'Apt 2',
      city: 'Kingston',
      state: 'St. Andrew',
      country: 'Jamaica',
      emergencyContactName: 'Emergency Contact',
      emergencyContactNumber: '+18761111111',
      primaryPhysicianName: 'Dr. Physician',
      primaryPhysicianNumber: '+18762222222',
      position: 'Manager',
      medicationInformation: 'None',
      withdrawalReason: 'N/A'
    };

    const updated = await updateCandidate('cand_1', patch, 'usr_reviewer_demo');

    expect(updated).toMatchObject(patch);
  });

  it('updateCandidate leaves every field alone when the patch is empty', async () => {
    const existing = samplePayload();
    findById.mockResolvedValue({ payload: existing });
    save.mockResolvedValue(undefined);

    const updated = await updateCandidate('cand_1', {}, 'usr_reviewer_demo');

    expect(updated).toEqual(existing);
  });
});
