import { Badge } from '../../../components/ui/badge';
import { StatusBadge } from '../../../components/ui/status-badge';
import { TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { CaseWorkspaceTabs } from './case-workspace-tabs';
import { SlaBadge } from '../../../components/ui/sla-badge';
import { getCandidateById } from '../../candidates/services/candidates-service';
import { listActiveDoctors, listUsers } from '../../users/services/users-service';
import { SubmissionViewer } from '../../submissions/components/submission-viewer';
import { listSubmissionsForCase } from '../../submissions/services/submissions-service';
import { getSettings } from '../../settings/services/settings-service';
import type { AuthenticatedSession } from '../../../lib/session';
import { formatCaseHistory } from '../case-history';
import { caseTypeLabel } from '../case-types';
import { caseRouteLabel, caseStageLabel } from '../case-stage';
import { computeSlaStatus } from '../sla';
import { listCaseAttachments } from '../services/case-attachments-service';
import { deriveCaseWorkspaceCapabilities } from '../case-workspace-capabilities';
import { ROLES } from '../../../lib/permissions';
import { getCaseWithPatientById, listCaseAuditEvents } from '../services/cases-service';
import { CaseActionsMenu } from './case-actions-menu';
import { CaseAttachmentList, type CaseDocumentSummary } from './case-documents/case-attachment-list';
import { CaseAttachmentUpload } from './case-documents/case-attachment-upload';
import { CasePdfExport } from './case-documents/case-pdf-export';
import { CaseHistoryTab } from './case-history-tab';
import { CaseBillingPanel } from './case-billing-panel';
import { PatientCaseReadOnlyView } from './patient-case-form/patient-case-read-only-view';

export interface StaffCaseWorkspaceProps {
  medicalCase: NonNullable<Awaited<ReturnType<typeof getCaseWithPatientById>>>;
  user: AuthenticatedSession['user'];
}

/**
 * The non-patient view of a case: HR/admin/reviewer/auditor/doctor/delegate all land here (after
 * case-detail-container.tsx's own auth + matchesClinicianAssignment check), just with different tabs/controls enabled
 * per deriveCaseWorkspaceCapabilities. One adaptive workspace rather than the old app's three
 * separate renderers (HR admin workspace / HR review-queue workspace / doctor's authoring form) —
 * tabs are always visible, but only the parts the current role+stage combination can act on show an
 * editable control; everything else renders read-only. Doctor's own tabbed authoring form is
 * deferred — "Doctor assessment" here is a read-only view of whatever's already been submitted.
 */
export async function StaffCaseWorkspace({ medicalCase, user }: StaffCaseWorkspaceProps) {
  const [candidate, submissions, doctors, allUsers, auditEvents, attachments, settings] = await Promise.all([
    getCandidateById(medicalCase.patientId),
    listSubmissionsForCase(medicalCase.id),
    listActiveDoctors(),
    listUsers(),
    listCaseAuditEvents(medicalCase.id),
    listCaseAttachments(medicalCase.id),
    getSettings()
  ]);

  const capabilities = deriveCaseWorkspaceCapabilities(user, medicalCase);
  const {
    canTransition,
    canReassign,
    canHide,
    canUploadDocuments,
    canViewHistory,
    hidePositionFromViewer,
    hideNationalIdFromViewer,
    exportLockedMessage,
    uploadLockedMessage,
    isPaid
  } = capabilities;

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

  const usersById = new Map(allUsers.map((entry) => [entry.id, { displayName: entry.displayName, role: entry.role }]));
  const assignedClinicianName = medicalCase.assignedClinicianId
    ? usersById.get(medicalCase.assignedClinicianId)?.displayName ?? 'Unknown doctor'
    : 'Unassigned';
  const historyEntries = formatCaseHistory(auditEvents, usersById);
  // Most-recent-first (see cases-service.ts's listCaseAuditEvents), so the first match of either
  // type is the current payment record — a correction (case_payment_corrected) after the original
  // confirmation should win, without needing to know which one actually happened last.
  const paymentConfirmedEvent = auditEvents.find(
    (event) => event.eventType === 'case_payment_confirmed' || event.eventType === 'case_payment_corrected'
  );
  const paymentConfirmedDetails = (paymentConfirmedEvent?.details as Record<string, unknown>) ?? {};
  const paidOn = paymentConfirmedDetails.paidOn ? String(paymentConfirmedDetails.paidOn) : null;
  const paymentConfirmedByName = paymentConfirmedEvent?.actorUserId
    ? usersById.get(paymentConfirmedEvent.actorUserId)?.displayName ?? 'Unknown user'
    : null;
  const documentSummaries: CaseDocumentSummary[] = attachments.map((attachment) => ({
    id: attachment.id,
    originalName: attachment.originalName,
    byteSize: Number(attachment.byteSize),
    createdAt: attachment.createdAt.toISOString(),
    uploaderName: (attachment.uploadedBy && usersById.get(attachment.uploadedBy)?.displayName) || 'Unknown user',
    canDelete: attachment.uploadedBy === user.id || user.role === ROLES.ADMIN
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
            {caseStageLabel(medicalCase.status, medicalCase.paymentStatus)} · Case {medicalCase.id}
          </p>
        </div>

        <CaseActionsMenu
          caseId={medicalCase.id}
          version={medicalCase.version}
          status={medicalCase.status}
          role={user.role}
          isPaid={isPaid}
          canTransition={canTransition}
          canReassign={canReassign}
          doctors={doctors.map((doctor) => ({ id: doctor.id, displayName: doctor.displayName }))}
          currentClinicianId={medicalCase.assignedClinicianId}
          canHide={canHide}
          hidden={medicalCase.payload?.hidden === true}
        />
      </div>

      <CaseWorkspaceTabs canViewHistory={canViewHistory}>
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
              hideNationalId={hideNationalIdFromViewer}
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
          <CaseBillingPanel
            caseId={medicalCase.id}
            version={medicalCase.version}
            status={medicalCase.status}
            payableAmount={medicalCase.payableAmount}
            paymentStatus={medicalCase.paymentStatus}
            paidOn={paidOn}
            paymentConfirmedByName={paymentConfirmedByName}
            capabilities={capabilities}
          />
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
      </CaseWorkspaceTabs>
    </div>
  );
}
