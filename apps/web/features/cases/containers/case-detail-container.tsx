import { redirect } from 'next/navigation';
import { SelectField } from '../../../components/form/select-field';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { getCandidateById, listCandidatesForUser } from '../../candidates/services/candidates-service';
import { listActiveDoctors, listUsers } from '../../users/services/users-service';
import { SubmissionViewer } from '../../submissions/components/submission-viewer';
import { listSubmissionsForCase } from '../../submissions/services/submissions-service';
import { updateCaseBillingAction } from '../actions/update-case-billing';
import { BILLING_STATUS_OPTIONS, derivedPaymentStatus } from '../billing-status';
import { formatCaseHistory } from '../case-history';
import { caseTypeLabel } from '../case-types';
import { ownsCase } from '../case-authorization';
import { CaseActionsMenu } from '../components/case-actions-menu';
import { CaseAttachmentList, type CaseDocumentSummary } from '../components/case-documents/case-attachment-list';
import { CaseAttachmentUpload } from '../components/case-documents/case-attachment-upload';
import { CasePdfExport } from '../components/case-documents/case-pdf-export';
import { CaseHistoryTab } from '../components/case-history-tab';
import { CompleteReviewCard } from '../components/complete-review-card';
import { CasePaymentConfirmation } from '../components/case-payment-confirmation';
import { CasePaymentSummary } from '../components/case-payment-summary';
import { PatientCaseForm } from '../components/patient-case-form/patient-case-form';
import { PatientCaseReadOnlyView } from '../components/patient-case-form/patient-case-read-only-view';
import { SlaBadge } from '../../../components/ui/sla-badge';
import { getSettings } from '../../settings/services/settings-service';
import { caseRouteLabel, caseStageLabel } from '../case-stage';
import { computeSlaStatus } from '../sla';
import { listCaseAttachments } from '../services/case-attachments-service';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, ROLES, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { formatCurrency } from '../../../lib/currency';
import { splitFullName } from '../../../lib/full-name';
import { statusLabel } from '../../../lib/status-labels';
import { emptyPatientCaseData } from '../patient-case-data';
import { getCaseWithPatientById, hasDoctorSubmitted, listCaseAuditEvents } from '../services/cases-service';

export interface CaseDetailContainerProps {
  caseId: string;
}

/**
 * One adaptive workspace rather than the old app's three separate renderers
 * (HR admin workspace / HR review-queue workspace / doctor's authoring
 * form) — tabs are always visible, but only the parts the current role+stage
 * combination can act on show an editable control; everything else renders
 * read-only. Doctor's own tabbed authoring form and the patient intake form
 * are deferred — "Doctor assessment" and "Patient form" here are read-only
 * views of whatever data already exists.
 */
export async function CaseDetailContainer({ caseId }: CaseDetailContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST)) {
    redirect('/');
  }

  const medicalCase = await getCaseWithPatientById(caseId);

  // MEDICAL_CASES_LIST is a broad "can see cases" permission that a patient
  // also holds (for their own dashboard) — without this, any patient could
  // view any other patient's case (name, DOB, contact info) just by knowing
  // its id, since the permission check above doesn't imply ownership.
  if (session.user.role === 'patient') {
    const ownCandidates = await listCandidatesForUser(session.user.id);
    const ownCandidate = medicalCase ? ownCandidates.find((candidate) => candidate.id === medicalCase.patientId) : undefined;
    if (!medicalCase || !ownCandidate) {
      return (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Case not found.</p>
        </div>
      );
    }

    const doctors = await listActiveDoctors();
    const existingData = medicalCase.payload?.patientCaseData;
    const { firstName, lastName } = splitFullName(ownCandidate.fullName);
    // First time this case is opened, seed the form from whatever HR already
    // collected on the candidate profile — address, phone numbers, primary
    // physician, and emergency contact all map straight across since both
    // forms use the exact same fields (AddressFields/PhoneNumbersField/
    // ContactFields) for them; see patient-case-data.ts's top comment.
    const baseData =
      existingData ??
      emptyPatientCaseData({
        firstName,
        lastName,
        dateOfBirth: ownCandidate.dateOfBirth,
        nationalId: ownCandidate.nationalId,
        addressLine1: ownCandidate.addressLine1,
        addressLine2: ownCandidate.addressLine2,
        city: ownCandidate.city,
        state: ownCandidate.state,
        country: ownCandidate.country,
        // The candidate profile's contactNumber has no per-entry type (just a
        // comma-joined list) — "Mobile" is a reasonable default label for
        // each one, since the patient can relabel/edit them here regardless.
        phones: ownCandidate.contactNumber
          ? ownCandidate.contactNumber
              .split(', ')
              .filter(Boolean)
              .map((number) => ({ type: 'Mobile', number }))
          : [],
        primaryPhysicianName: ownCandidate.primaryPhysicianName,
        primaryPhysicianNumber: ownCandidate.primaryPhysicianNumber,
        emergencyContactName: ownCandidate.emergencyContactName,
        emergencyContactNumber: ownCandidate.emergencyContactNumber
      });
    // Backfills from the candidate profile even for an already-in-progress case (existingData) —
    // not just a brand-new one — so a draft saved before dateOfBirth/nationalId existed on this
    // form (or one where the patient just hasn't touched that field yet) still shows HR's own value
    // instead of a blank the patient has to go dig up and retype themselves.
    const data = {
      ...baseData,
      personalInfo: {
        ...baseData.personalInfo,
        dateOfBirth: baseData.personalInfo.dateOfBirth || ownCandidate.dateOfBirth,
        nationalId: baseData.personalInfo.nationalId || ownCandidate.nationalId
      }
    };

    return (
      <div className="flex flex-col gap-4 p-6">
        <PatientCaseForm
          caseId={medicalCase.id}
          version={medicalCase.version}
          data={data}
          employeeId={ownCandidate.employeeId}
          email={ownCandidate.email}
          doctors={doctors}
          readOnly={medicalCase.status !== 'sent_to_patient'}
        />
      </div>
    );
  }

  if (!medicalCase) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  // Same reasoning as the patient branch above: MEDICAL_CASES_LIST is a broad "can see cases"
  // permission a clinician also holds, but that must not mean "any case in the system" — without
  // this, a doctor could open another doctor's assigned case (full candidate PII, family/medical
  // history) just by guessing/incrementing a case id.
  if (!ownsCase(session.user, medicalCase)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.MEDICAL_CASES_LIST,
      path: '/cases',
      entityId: caseId
    });
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  const [candidate, submissions, doctors, allUsers, auditEvents, attachments, settings] = await Promise.all([
    getCandidateById(medicalCase.patientId),
    listSubmissionsForCase(caseId),
    listActiveDoctors(),
    listUsers(),
    listCaseAuditEvents(caseId),
    listCaseAttachments(caseId),
    getSettings()
  ]);
  const slaStages = computeSlaStatus(
    {
      createdAt: medicalCase.createdAt,
      assignedAt: medicalCase.assignedAt,
      doctorSubmittedAt: medicalCase.doctorSubmittedAt,
      reviewedAt: medicalCase.reviewedAt,
      paymentConfirmedAt: medicalCase.paymentConfirmedAt
    },
    settings.sla.definitions
  );
  const latestSubmission = submissions[0] ?? null;

  const canUpdateBilling = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE);
  // Read-only visibility into the payable amount — previously shown unconditionally to anyone who
  // could view the case at all; gated now so a delegate's access to it can be toggled per-account
  // (see permissionOverrides) without changing what admin/reviewer/auditor/doctor already see.
  const canViewBilling = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_BILLING_VIEW);
  const canConfirmPayment = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM);
  const isPaid = medicalCase.paymentStatus === 'paid';
  const canTransition = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_TRANSITION);
  const canReassign = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_REASSIGN);
  const canHide = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_HIDE);
  const canUploadDocuments = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_ATTACH) && ownsCase(session.user, medicalCase);
  // Doctors (and their delegates) shouldn't see the audit trail while assessing/reviewing a case —
  // History is an HR/admin oversight tool, not something relevant to the clinician's own workflow.
  const canViewHistory = session.user.role !== ROLES.DOCTOR && session.user.role !== ROLES.DELEGATE;
  // Nor the role the candidate applied for — showing it to the examining clinician risks biasing
  // the assessment toward (or against) fitness for that specific role.
  const hidePositionFromViewer = session.user.role === ROLES.DOCTOR || session.user.role === ROLES.DELEGATE;

  const usersById = new Map(allUsers.map((user) => [user.id, { displayName: user.displayName, role: user.role }]));
  const assignedClinicianName = medicalCase.assignedClinicianId
    ? usersById.get(medicalCase.assignedClinicianId)?.displayName ?? 'Unknown doctor'
    : 'Unassigned';
  const historyEntries = formatCaseHistory(auditEvents, usersById);
  const paymentConfirmedEvent = auditEvents.find((event) => event.eventType === 'case_payment_confirmed');
  const paymentConfirmedDetails = (paymentConfirmedEvent?.details as Record<string, unknown>) ?? {};
  const paidOn = paymentConfirmedDetails.paidOn ? String(paymentConfirmedDetails.paidOn) : null;
  const paymentConfirmedByName = paymentConfirmedEvent?.actorUserId
    ? usersById.get(paymentConfirmedEvent.actorUserId)?.displayName ?? 'Unknown user'
    : null;
  // Billing amount/status, exporting, and uploading a stamped copy all
  // require a completed doctor assessment to mean anything — before then
  // there's nothing to bill, nothing to print, and nothing to stamp, so
  // those controls are shown greyed out rather than editable/hidden while a
  // case is still sitting with the patient or the doctor. See
  // cases-service.ts's hasDoctorSubmitted (also enforced server-side by
  // confirmCasePaymentAction/updateCaseBillingAction).
  const doctorHasSubmitted = hasDoctorSubmitted(medicalCase.status);

  // A case fresh off the doctor's desk still needs HR to actually look at it
  // before billing/payment/export mean anything — see the Complete review
  // action on the Billing & status tab (complete-review-card.tsx), which is
  // what clears this.
  const awaitingReview = medicalCase.status === 'doctor_submitted';
  const billingLocked = !doctorHasSubmitted || awaitingReview;
  const billingLockedMessage = !doctorHasSubmitted
    ? "Available once the doctor's assessment has been submitted — there's nothing to pay before then."
    : awaitingReview
      ? 'Complete review above before confirming payment.'
      : undefined;

  // Export is further gated even after the doctor submits — forces HR to
  // mark the case reviewed first — but this never blocks the doctor's own
  // authoring page (DoctorCaseForm never renders while a case is anything
  // but sent_to_doctor, so this gate has no effect there).
  const exportLockedMessage = !doctorHasSubmitted
    ? "Available once the doctor's assessment has been submitted — there's nothing to export before then."
    : awaitingReview
      ? 'Complete review on the Billing & status tab before exporting it.'
      : undefined;
  const uploadLockedMessage = !doctorHasSubmitted
    ? "Available once the doctor's assessment has been submitted — there's nothing to stamp before then."
    : undefined;
  const documentSummaries: CaseDocumentSummary[] = attachments.map((attachment) => ({
    id: attachment.id,
    originalName: attachment.originalName,
    byteSize: Number(attachment.byteSize),
    createdAt: attachment.createdAt.toISOString(),
    uploaderName: (attachment.uploadedBy && usersById.get(attachment.uploadedBy)?.displayName) || 'Unknown user',
    canDelete: attachment.uploadedBy === session.user.id || session.user.role === ROLES.ADMIN
  }));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{medicalCase.patient.fullName}</h1>
            <StatusBadge status={medicalCase.status} />
            {medicalCase.payload?.hidden ? <Badge variant="outline">Hidden from queues</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {caseStageLabel(medicalCase.status)} · Case {medicalCase.id}
          </p>
        </div>

        <CaseActionsMenu
          caseId={medicalCase.id}
          version={medicalCase.version}
          status={medicalCase.status}
          role={session.user.role}
          canTransition={canTransition}
          canReassign={canReassign}
          doctors={doctors.map((doctor) => ({ id: doctor.id, displayName: doctor.displayName }))}
          currentClinicianId={medicalCase.assignedClinicianId}
          canHide={canHide}
          hidden={medicalCase.payload?.hidden === true}
        />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patient">Patient form</TabsTrigger>
            <TabsTrigger value="doctor">Doctor assessment</TabsTrigger>
            <TabsTrigger value="billing">Billing &amp; status</TabsTrigger>
            {canViewHistory ? <TabsTrigger value="history">History</TabsTrigger> : null}
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="rounded-md border p-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Patient', medicalCase.patient.fullName],
              ['Employee ID', medicalCase.patient.employeeId || '—'],
              ...(hidePositionFromViewer ? [] : [['Position applied for', medicalCase.payload?.positionAppliedFor || '—']]),
              ['Medical type', caseTypeLabel(medicalCase.payload?.caseType)],
              ['Initial routing', caseRouteLabel(medicalCase.route)],
              ['Assigned clinician', assignedClinicianName],
              ['Created', new Date(medicalCase.createdAt).toLocaleString()],
              ['Updated', new Date(medicalCase.updatedAt).toLocaleString()]
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {slaStages.length > 0 ? (
            <div className="mt-6 flex flex-col gap-2 border-t pt-4">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">SLA</h3>
              {slaStages.map((stage) => (
                <div key={stage.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {stage.status === 'not_applicable' ? `Target ${stage.targetHours}h` : `${Math.round(stage.elapsedHours)}h of ${stage.targetHours}h`}
                    </span>
                    <SlaBadge status={stage.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="patient" className="rounded-md border p-4">
          {!candidate ? (
            <p className="text-sm text-muted-foreground">Candidate profile not found.</p>
          ) : medicalCase.payload?.patientCaseData ? (
            <PatientCaseReadOnlyView
              data={medicalCase.payload.patientCaseData}
              employeeId={candidate.employeeId}
              email={candidate.email}
              doctors={doctors}
              hideNationalId={hidePositionFromViewer}
            />
          ) : (
            <p className="text-sm text-muted-foreground">The patient hasn&apos;t completed their intake form yet.</p>
          )}
        </TabsContent>

        <TabsContent value="doctor" className={latestSubmission ? undefined : 'rounded-md border p-4'}>
          {latestSubmission ? (
            <SubmissionViewer submission={latestSubmission} patientSex={medicalCase.payload?.patientCaseData?.personalInfo.sex} />
          ) : (
            <p className="text-sm text-muted-foreground">No doctor assessment submitted yet.</p>
          )}
        </TabsContent>

        <TabsContent value="billing" className="flex flex-col gap-4 rounded-md border p-4">
          {awaitingReview && canTransition ? (
            <CompleteReviewCard caseId={medicalCase.id} version={medicalCase.version} />
          ) : null}

          {canUpdateBilling ? (
            <form action={updateCaseBillingAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="caseId" value={medicalCase.id} />
              <fieldset disabled={billingLocked} className="contents">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="payableAmount" className="text-xs font-medium text-muted-foreground">
                    Payable amount
                  </label>
                  <input
                    id="payableAmount"
                    name="payableAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={medicalCase.payableAmount ? Number(medicalCase.payableAmount) : ''}
                    className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <SelectField
                  name="paymentStatus"
                  label="Payment status"
                  defaultValue={derivedPaymentStatus(medicalCase.status, medicalCase.paymentStatus)}
                  options={BILLING_STATUS_OPTIONS.map((status) => ({ value: status, label: statusLabel(status) }))}
                  className="h-9 w-44"
                  disabled={billingLocked}
                />
                <Button type="submit" size="sm" variant="secondary">
                  Save billing
                </Button>
              </fieldset>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="flex flex-col">
                <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Payment status</dt>
                <dd className="text-sm">{medicalCase.paymentStatus ? statusLabel(medicalCase.paymentStatus) : '—'}</dd>
              </div>
              {canViewBilling ? (
                <div className="flex flex-col">
                  <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Payable amount</dt>
                  <dd className="text-sm">{medicalCase.payableAmount ? formatCurrency(Number(medicalCase.payableAmount)) : '—'}</dd>
                </div>
              ) : null}
            </dl>
          )}

          {canUpdateBilling ? (
            <p className="text-xs text-muted-foreground">
              {!doctorHasSubmitted
                ? "Available once the doctor's assessment has been submitted — there's nothing to bill before then."
                : awaitingReview
                  ? 'Complete review above before adjusting billing.'
                  : "Set automatically from the doctor's rate when they submit their assessment — adjusting it here doesn't change that doctor's own rate, only this case's billed amount."}
            </p>
          ) : null}

          {isPaid ? (
            <CasePaymentSummary paidOn={paidOn} confirmedByName={paymentConfirmedByName} />
          ) : canConfirmPayment ? (
            <CasePaymentConfirmation caseId={medicalCase.id} lockedMessage={billingLockedMessage} />
          ) : null}
        </TabsContent>

        {canViewHistory ? (
          <TabsContent value="history" className="rounded-md border p-4">
            <CaseHistoryTab entries={historyEntries} />
          </TabsContent>
        ) : null}

        <TabsContent value="documents" className="flex flex-col gap-4 rounded-md border p-4">
          <CasePdfExport
            caseId={medicalCase.id}
            candidate={
              candidate ?? { fullName: medicalCase.patient.fullName, employeeId: medicalCase.patient.employeeId ?? '', dateOfBirth: '', email: '', contactNumber: '', position: '' }
            }
            caseTypeLabel={caseTypeLabel(medicalCase.payload?.caseType)}
            patientCaseData={medicalCase.payload?.patientCaseData ?? null}
            submission={latestSubmission}
            hidePosition={hidePositionFromViewer}
            lockedMessage={exportLockedMessage}
            logoUrl={settings.general.largeLogoDataUrl || undefined}
          />
          {canUploadDocuments ? <CaseAttachmentUpload caseId={medicalCase.id} lockedMessage={uploadLockedMessage} /> : null}
          <CaseAttachmentList caseId={medicalCase.id} attachments={documentSummaries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
