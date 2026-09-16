import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const listAll = vi.fn();
const listAllWithPatient = vi.fn();
const findById = vi.fn();
const findByIdWithPatient = vi.fn();
const transition = vi.fn();
const setAssignedClinician = vi.fn();
const confirmPayment = vi.fn();
const submitAndTransition = vi.fn();
const updatePayload = vi.fn();
const setBilling = vi.fn();
const listForClinician = vi.fn();
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
    confirmPayment: (...args: unknown[]) => confirmPayment(...args),
    submitAndTransition: (...args: unknown[]) => submitAndTransition(...args),
    updatePayload: (...args: unknown[]) => updatePayload(...args),
    setBilling: (...args: unknown[]) => setBilling(...args),
    listForClinician: (...args: unknown[]) => listForClinician(...args)
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
  submitPatientCase,
  setCaseHidden,
  confirmCasePayment,
  setCaseBilling,
  hasDoctorSubmitted,
  listReviewQueueCases,
  countCasesForClinician,
  saveDoctorAssessmentDraft
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
    confirmPayment.mockReset();
    submitAndTransition.mockReset();
    updatePayload.mockReset();
    updatePayload.mockResolvedValue({ id: 'case_1', version: 5 });
    setBilling.mockReset();
    listForClinician.mockReset();
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

  // Payment-status normalization on withdraw/cancel (a canceled case is never billable) now
  // happens inside the transition_medical_case stored procedure itself (see
  // packages/database's 0018_atomic_case_transitions migration) as part of the same atomic
  // statement as the transition, not as a separate JS-layer call — so there's no longer a
  // repository call on this side to assert against; that behavior is covered by the migration's
  // own SQL, not a unit test here.

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

  it('confirmCasePayment sets paid status and the confirmed-at timestamp in one call', async () => {
    confirmPayment.mockResolvedValue(undefined);
    findById.mockResolvedValue({ patientId: 'cand_1', assignedClinicianId: null });

    await confirmCasePayment('case_1', '2026-01-05', 'usr_reviewer_demo');

    expect(confirmPayment).toHaveBeenCalledWith('case_1', new Date('2026-01-05'));
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case_payment_confirmed',
        actorUserId: 'usr_reviewer_demo',
        entityType: 'case',
        entityId: 'case_1',
        details: { paidOn: '2026-01-05' }
      })
    );
  });

  it('confirmCasePayment notifies the assigned doctor, and does nothing when no doctor is assigned', async () => {
    confirmPayment.mockResolvedValue(undefined);
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

  it('setCaseHidden writes the flag into the payload alongside whatever else was there, checks the caller-supplied version, and audits it', async () => {
    await setCaseHidden('case_1', true, 'usr_reviewer_demo', { caseType: 'pre_employment' }, 4);

    expect(updatePayload).toHaveBeenCalledWith('case_1', { caseType: 'pre_employment', hidden: true }, masterKey, undefined, 4);
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'case_hidden', actorUserId: 'usr_reviewer_demo', entityType: 'case', entityId: 'case_1' })
    );
  });

  it('setCaseHidden(false) unhides and audits case_unhidden', async () => {
    await setCaseHidden('case_1', false, 'usr_reviewer_demo', { hidden: true }, 4);

    expect(updatePayload).toHaveBeenCalledWith('case_1', { hidden: false }, masterKey, undefined, 4);
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'case_unhidden' }));
  });

  it('saveDoctorAssessmentDraft persists the draft and stamps who last edited it, alongside whatever else was in the payload, returning the new version', async () => {
    const newVersion = await saveDoctorAssessmentDraft(
      'case_1',
      { assessment: { note: 'wip' } },
      { caseType: 'pre_employment' },
      'usr_delegate_demo',
      4
    );

    expect(newVersion).toBe(5);
    expect(updatePayload).toHaveBeenCalledWith(
      'case_1',
      { caseType: 'pre_employment', doctorAssessmentDraft: { assessment: { note: 'wip' } } },
      masterKey,
      { lastEditedById: 'usr_delegate_demo', lastEditedAt: expect.any(Date) },
      4
    );
  });

  it('saveDoctorAssessmentDraft preserves attestation/determination a delegate is not allowed to send, instead of erasing them', async () => {
    const existingPayload = {
      caseType: 'pre_employment',
      doctorAssessmentDraft: { assessment: { note: 'doctor wrote this' }, determination: 'fit', attestation: { signed: true } }
    };
    // Mirrors save-submission-draft.ts's own defense-in-depth: a delegate's posted draft never has
    // determination/attestation at all (stripped before this is even called).
    const delegateDraft = { assessment: { note: 'delegate edit' } };

    await saveDoctorAssessmentDraft('case_1', delegateDraft, existingPayload, 'usr_delegate_demo', 4);

    expect(updatePayload).toHaveBeenCalledWith(
      'case_1',
      {
        caseType: 'pre_employment',
        doctorAssessmentDraft: {
          assessment: { note: 'delegate edit' },
          determination: 'fit',
          attestation: { signed: true }
        }
      },
      masterKey,
      { lastEditedById: 'usr_delegate_demo', lastEditedAt: expect.any(Date) },
      4
    );
  });

  it('transitionCase to sent_to_doctor notifies the assigned doctor, cc-ing the configured doctor notification address', async () => {
    findById.mockResolvedValue({ status: 'draft', patientId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' });
    transition.mockResolvedValue(2);
    usersFindById.mockResolvedValue({ email: 'doctor@ncb.local', displayName: 'Dr. Demo' });
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe' });
    settingsRead.mockResolvedValue({ notifications: { doctorNotificationEmail: 'doctors@ncb.local' } });

    await transitionCase('case_1', 1, 'sent_to_doctor', 'usr_reviewer_demo');

    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'case_moved_forward',
        to: 'doctor@ncb.local',
        extraCc: 'doctors@ncb.local',
        variables: { caseId: 'case_1', patientName: 'Jane Doe', doctorName: 'Dr. Demo' }
      })
    );
  });

  it('transitionCase to reviewed uses the case_reviewed template instead', async () => {
    findById.mockResolvedValue({ status: 'doctor_submitted', patientId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' });
    transition.mockResolvedValue(2);
    usersFindById.mockResolvedValue({ email: 'doctor@ncb.local', displayName: 'Dr. Demo' });
    getCandidateByIdMock.mockResolvedValue({ fullName: 'Jane Doe' });

    await transitionCase('case_1', 1, 'reviewed', 'usr_reviewer_demo');

    expect(sendNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ templateKey: 'case_reviewed' }));
  });

  it('transitionCase to sent_to_doctor skips notifying entirely when no doctor is assigned', async () => {
    findById.mockResolvedValue({ status: 'draft', patientId: 'cand_1', assignedClinicianId: null });
    transition.mockResolvedValue(2);

    await transitionCase('case_1', 1, 'sent_to_doctor', 'usr_reviewer_demo');

    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(usersFindById).not.toHaveBeenCalled();
  });

  it('transitionCase to sent_to_doctor skips notifying when the assigned doctor has no email on file', async () => {
    findById.mockResolvedValue({ status: 'draft', patientId: 'cand_1', assignedClinicianId: 'usr_doctor_demo' });
    transition.mockResolvedValue(2);
    usersFindById.mockResolvedValue({ email: '', displayName: 'Dr. Demo' });

    await transitionCase('case_1', 1, 'sent_to_doctor', 'usr_reviewer_demo');

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('setCaseBilling writes payableAmount/paymentStatus straight through and audits it', async () => {
    await setCaseBilling('case_1', 150, 'unpaid', 'usr_admin_demo');

    expect(setBilling).toHaveBeenCalledWith('case_1', 150, 'unpaid');
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case_billing_updated',
        actorUserId: 'usr_admin_demo',
        entityType: 'case',
        entityId: 'case_1',
        details: { payableAmount: 150, paymentStatus: 'unpaid' }
      })
    );
  });

  describe('submitPatientCase', () => {
    it('delegates the atomic write to submitAndTransition with the expected version and clinician', async () => {
      submitAndTransition.mockResolvedValue({ newVersion: 2, previousStatus: 'sent_to_patient' });

      await submitPatientCase(
        'case_1',
        { assignedClinicianId: 'usr_doctor_demo' } as never,
        1,
        'usr_patient_demo',
        { caseType: 'pre_employment' }
      );

      expect(submitAndTransition).toHaveBeenCalledWith(
        {
          caseId: 'case_1',
          payload: { caseType: 'pre_employment', patientCaseData: { assignedClinicianId: 'usr_doctor_demo' } },
          assignedClinicianId: 'usr_doctor_demo',
          expectedVersion: 1,
          newStatus: 'sent_to_doctor',
          actorId: 'usr_patient_demo'
        },
        masterKey
      );
    });

    it('finalizes the transition (audit + notify) only after the transaction resolves, using its reported previousStatus', async () => {
      submitAndTransition.mockResolvedValue({ newVersion: 2, previousStatus: 'sent_to_patient' });
      findById.mockResolvedValue({ patientId: 'cand_1', assignedClinicianId: null });

      const newVersion = await submitPatientCase('case_1', { assignedClinicianId: 'usr_doctor_demo' } as never, 1, 'usr_patient_demo');

      expect(newVersion).toBe(2);
      expect(auditAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'case_transition',
          actorUserId: 'usr_patient_demo',
          entityId: 'case_1',
          details: { from: 'sent_to_patient', to: 'sent_to_doctor' }
        })
      );
    });

    it('propagates a version-mismatch rejection without calling finalizeCaseTransition', async () => {
      submitAndTransition.mockRejectedValue(new Error('Medical case changed or does not exist'));

      await expect(
        submitPatientCase('case_1', { assignedClinicianId: 'usr_doctor_demo' } as never, 99, 'usr_patient_demo')
      ).rejects.toThrow('Medical case changed or does not exist');
      expect(auditAppend).not.toHaveBeenCalled();
    });
  });

  describe('hasDoctorSubmitted', () => {
    it.each(['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor'])('is false while pre-doctor (%s)', (status) => {
      expect(hasDoctorSubmitted(status)).toBe(false);
    });

    it.each(['doctor_submitted', 'reviewed', 'archived', 'withdrawn'])('is true once past the doctor stage (%s)', (status) => {
      expect(hasDoctorSubmitted(status)).toBe(true);
    });
  });

  it('listReviewQueueCases includes doctor_submitted/reviewed cases not yet paid, excludes paid or pre-doctor ones', async () => {
    listAllWithPatient.mockResolvedValue([
      { id: 'case_1', status: 'doctor_submitted', paymentStatus: 'unpaid' },
      { id: 'case_2', status: 'reviewed', paymentStatus: 'paid' },
      { id: 'case_3', status: 'sent_to_doctor', paymentStatus: null }
    ]);

    const result = await listReviewQueueCases();

    expect(result.map((c) => c.id)).toEqual(['case_1']);
  });

  it("countCasesForClinician tallies total vs. still-active (excluding reviewed/archived/canceled/withdrawn)", async () => {
    listForClinician.mockResolvedValue([
      { status: 'sent_to_doctor' },
      { status: 'doctor_submitted' },
      { status: 'reviewed' },
      { status: 'withdrawn' }
    ]);

    const result = await countCasesForClinician('usr_doctor_demo');

    expect(result).toEqual({ total: 4, active: 2 });
  });
});
