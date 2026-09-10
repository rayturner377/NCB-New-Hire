import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const listAll = vi.fn();
const listAllWithPatient = vi.fn();
const findById = vi.fn();
const findByIdWithPatient = vi.fn();
const transition = vi.fn();
const setAssignedClinician = vi.fn();
const setPaymentStatus = vi.fn();
const setPaymentConfirmedAt = vi.fn();
const updatePayload = vi.fn();
const auditAppend = vi.fn();
const auditListForEntity = vi.fn();
const settingsRead = vi.fn();
const usersFindById = vi.fn();
const getCandidateByIdMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock('@ncb/database', () => ({
  casesRepository: {
    create: (...args: unknown[]) => create(...args),
    listAll: (...args: unknown[]) => listAll(...args),
    listAllWithPatient: (...args: unknown[]) => listAllWithPatient(...args),
    findById: (...args: unknown[]) => findById(...args),
    findByIdWithPatient: (...args: unknown[]) => findByIdWithPatient(...args),
    transition: (...args: unknown[]) => transition(...args),
    setAssignedClinician: (...args: unknown[]) => setAssignedClinician(...args),
    setPaymentStatus: (...args: unknown[]) => setPaymentStatus(...args),
    setPaymentConfirmedAt: (...args: unknown[]) => setPaymentConfirmedAt(...args),
    updatePayload: (...args: unknown[]) => updatePayload(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppend(...args),
    listForEntity: (...args: unknown[]) => auditListForEntity(...args)
  },
  usersRepository: {
    findById: (...args: unknown[]) => usersFindById(...args)
  },
  // Read by getSettings() (features/settings/services/settings-service.ts), which
  // notifyOnTransition/confirmCasePayment call for the reviewer/doctor notification-copy
  // addresses — null here means "no settings saved yet", so getSettings() falls back to
  // DEFAULT_SETTINGS.
  settingsRepository: {
    read: (...args: unknown[]) => settingsRead(...args),
    write: vi.fn()
  }
}));

const masterKey = randomBytes(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));
vi.mock('../../../../candidates/services/candidates-service', () => ({
  getCandidateById: (...args: unknown[]) => getCandidateByIdMock(...args)
}));
vi.mock('../../../../notifications/services/notification-service', () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args)
}));

const {
  createCase,
  getCaseById,
  getCaseWithPatientById,
  listCases,
  listCasesWithPatient,
  listCaseAuditEvents,
  reassignClinician,
  transitionCase,
  setCaseHidden,
  confirmCasePayment
} = await import('../../cases-service');

describe('cases service', () => {
  beforeEach(() => {
    create.mockReset();
    listAll.mockReset();
    listAllWithPatient.mockReset();
    findById.mockReset();
    findByIdWithPatient.mockReset();
    transition.mockReset();
    setAssignedClinician.mockReset();
    setPaymentStatus.mockReset();
    setPaymentConfirmedAt.mockReset();
    updatePayload.mockReset();
    auditAppend.mockReset();
    auditListForEntity.mockReset();
    settingsRead.mockReset();
    settingsRead.mockResolvedValue(null);
    usersFindById.mockReset();
    getCandidateByIdMock.mockReset();
    sendNotificationMock.mockReset();
  });

  it('createCase routes to sent_to_patient when no doctor is assigned', async () => {
    create.mockResolvedValue({ id: 'case_1' });

    await createCase({
      patientId: 'cand_1',
      assignedClinicianId: '',
      caseType: 'pre_employment',
      positionAppliedFor: 'Teller',
      createdBy: 'usr_reviewer_demo'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'cand_1',
        route: 'patient',
        status: 'sent_to_patient',
        payload: { positionAppliedFor: 'Teller', caseType: 'pre_employment' }
      }),
      masterKey
    );
  });

  it('createCase routes to sent_to_doctor when a doctor is assigned', async () => {
    create.mockResolvedValue({ id: 'case_1' });

    await createCase({
      patientId: 'cand_1',
      assignedClinicianId: 'usr_doctor_demo',
      caseType: 'required_medical',
      positionAppliedFor: 'Branch supervisor',
      createdBy: 'usr_reviewer_demo'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'doctor',
        status: 'sent_to_doctor',
        assignedClinicianId: 'usr_doctor_demo',
        payload: { positionAppliedFor: 'Branch supervisor', caseType: 'required_medical' }
      }),
      masterKey
    );
  });

  it('listCases passes the master key through', async () => {
    listAll.mockResolvedValue([]);
    await listCases();
    expect(listAll).toHaveBeenCalledWith(masterKey);
  });

  it('listCasesWithPatient passes the master key through', async () => {
    listAllWithPatient.mockResolvedValue([]);
    await listCasesWithPatient();
    expect(listAllWithPatient).toHaveBeenCalledWith(masterKey);
  });

  it('getCaseById passes the master key through', async () => {
    findById.mockResolvedValue(null);
    await getCaseById('case_1');
    expect(findById).toHaveBeenCalledWith('case_1', masterKey);
  });

  it('getCaseWithPatientById passes the master key through', async () => {
    findByIdWithPatient.mockResolvedValue(null);
    await getCaseWithPatientById('case_1');
    expect(findByIdWithPatient).toHaveBeenCalledWith('case_1', masterKey);
  });

  it('transitionCase forwards to the repository and audits the from/to status', async () => {
    findById.mockResolvedValue({ status: 'doctor_submitted' });
    transition.mockResolvedValue(2);

    const result = await transitionCase('case_1', 1, 'reviewed', 'usr_reviewer_demo');

    expect(transition).toHaveBeenCalledWith('case_1', 1, 'reviewed', 'usr_reviewer_demo');
    expect(result).toBe(2);
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case_transition',
        actorUserId: 'usr_reviewer_demo',
        entityType: 'case',
        entityId: 'case_1',
        details: { from: 'doctor_submitted', to: 'reviewed' }
      })
    );
  });

  it('transitionCase does not audit when the repository transition itself throws', async () => {
    findById.mockResolvedValue({ status: 'sent_to_doctor' });
    transition.mockRejectedValue(new Error('Medical case changed or does not exist'));

    await expect(transitionCase('case_1', 1, 'reviewed', 'usr_reviewer_demo')).rejects.toThrow();
    expect(auditAppend).not.toHaveBeenCalled();
  });

  it('transitionCase to withdrawn also marks the case not_payable — a canceled case is never billable', async () => {
    findById.mockResolvedValue({ status: 'doctor_submitted' });
    transition.mockResolvedValue(2);

    await transitionCase('case_1', 1, 'withdrawn', 'usr_reviewer_demo');

    expect(setPaymentStatus).toHaveBeenCalledWith('case_1', 'not_payable');
  });

  it('transitionCase to any other status leaves payment status alone', async () => {
    findById.mockResolvedValue({ status: 'doctor_submitted' });
    transition.mockResolvedValue(2);

    await transitionCase('case_1', 1, 'reviewed', 'usr_reviewer_demo');

    expect(setPaymentStatus).not.toHaveBeenCalled();
  });

  it('transitionCase to doctor_submitted notifies the configured reviewer address', async () => {
    findById.mockResolvedValue({ status: 'sent_to_doctor', patientId: 'cand_1' });
    transition.mockResolvedValue(2);
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe' });
    settingsRead.mockResolvedValue({ notifications: { reviewerNotificationEmail: 'reviewers@ncb.local' } });

    await transitionCase('case_1', 1, 'doctor_submitted', 'usr_doctor_demo');

    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'case_doctor_submitted',
        to: 'reviewers@ncb.local',
        variables: { caseId: 'case_1', patientName: 'Jane Doe' }
      })
    );
  });

  it('transitionCase to sent_to_patient notifies the patient directly, and skips it entirely when they have no email on file', async () => {
    findById.mockResolvedValue({ status: 'doctor_submitted', patientId: 'cand_1' });
    transition.mockResolvedValue(2);
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe', email: 'jane@example.com' });

    await transitionCase('case_1', 1, 'sent_to_patient', 'usr_reviewer_demo');

    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'case_sent_back', to: 'jane@example.com' })
    );

    sendNotificationMock.mockClear();
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe', email: '' });

    await transitionCase('case_1', 2, 'sent_to_patient', 'usr_reviewer_demo');

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('confirmCasePayment notifies the assigned doctor, and does nothing when no doctor is assigned', async () => {
    setPaymentStatus.mockResolvedValue(undefined);
    findById.mockResolvedValue({ patientId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' });
    usersFindById.mockResolvedValue({ email: 'doctor@ncb.local', displayName: 'Dr. One' });
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe' });
    settingsRead.mockResolvedValue({ notifications: { doctorNotificationEmail: 'doctors-admin@ncb.local' } });

    await confirmCasePayment('case_1', '2026-01-05', 'usr_reviewer_demo');

    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'case_payment_confirmed',
        to: 'doctor@ncb.local',
        extraCc: 'doctors-admin@ncb.local',
        variables: { caseId: 'case_1', patientName: 'Jane Doe', paidOn: '2026-01-05' }
      })
    );

    sendNotificationMock.mockClear();
    findById.mockResolvedValue({ patientId: 'cand_1', assignedClinicianId: null });

    await confirmCasePayment('case_1', '2026-01-05', 'usr_reviewer_demo');

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('reassignClinician sets the new clinician and audits the from/to doctor', async () => {
    findById.mockResolvedValue({ assignedClinicianId: 'usr_doctor_old' });

    await reassignClinician('case_1', 'usr_doctor_new', 'usr_reviewer_demo');

    expect(setAssignedClinician).toHaveBeenCalledWith('case_1', 'usr_doctor_new');
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case_reassigned',
        actorUserId: 'usr_reviewer_demo',
        entityType: 'case',
        entityId: 'case_1',
        details: { from: 'usr_doctor_old', to: 'usr_doctor_new' }
      })
    );
  });

  it('listCaseAuditEvents reads the case entity history', async () => {
    auditListForEntity.mockResolvedValue([]);
    await listCaseAuditEvents('case_1');
    expect(auditListForEntity).toHaveBeenCalledWith('case', 'case_1');
  });

  it('setCaseHidden writes the flag into the payload alongside whatever else was there, and audits it', async () => {
    await setCaseHidden('case_1', true, 'usr_reviewer_demo', { caseType: 'pre_employment' });

    expect(updatePayload).toHaveBeenCalledWith('case_1', { caseType: 'pre_employment', hidden: true }, masterKey);
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'case_hidden', actorUserId: 'usr_reviewer_demo', entityType: 'case', entityId: 'case_1' })
    );
  });

  it('setCaseHidden(false) unhides and audits case_unhidden', async () => {
    await setCaseHidden('case_1', false, 'usr_reviewer_demo', { hidden: true });

    expect(updatePayload).toHaveBeenCalledWith('case_1', { hidden: false }, masterKey);
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'case_unhidden' }));
  });
});
