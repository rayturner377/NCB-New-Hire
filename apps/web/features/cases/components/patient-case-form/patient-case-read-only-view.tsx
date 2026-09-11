'use client';

import { Fragment, useState } from 'react';
import { TabbedFormShell, type TabbedFormShellTab } from '../../../../components/form/tabbed-form-shell';
import { Separator } from '../../../../components/ui/separator';
import type { PatientCaseData } from '../../patient-case-data';
import type { UserSummary } from '../../../users/types';
import { ConsentTab } from './consent-tab';
import { FamilyHistoryTab } from './family-history-tab';
import { MedicalHistoryTab } from './medical-history-tab';
import { PersonalInfoTab } from './personal-info-tab';

export interface PatientCaseReadOnlyViewProps {
  data: PatientCaseData;
  employeeId: string;
  email: string;
  doctors: UserSummary[];
  /**
   * 'tabs' (default): bite-sized sub-tabs, one section at a time — used by
   * the HR/admin/reviewer case workspace (case-detail-container.tsx), which
   * has nothing else going on in that tab, so drilling down further reads
   * fine. 'flat': every section stacked on one scrollable page instead —
   * used by the doctor's own assessment form (doctor-case-form.tsx), where
   * this is just step one ("read what the patient entered") before the
   * doctor's own multi-tab assessment; nesting a second full tab bar inside
   * that first tab was one navigation layer more than reviewing intake
   * actually needs.
   */
  layout?: 'tabs' | 'flat';
}

const TAB_ORDER = ['personal', 'family', 'medical', 'consent'] as const;
type TabValue = (typeof TAB_ORDER)[number];

/**
 * Everything the patient entered, read-only, for anyone downstream who needs
 * to see it without being able to change it (the doctor's own assessment
 * form's "Patient submission" tab, and HR/admin/reviewer's case workspace —
 * see features/submissions/components/doctor-case-form and
 * case-detail-container.tsx). Reuses the patient's own tab components
 * directly in `disabled` mode (they're already pure `defaultValue`/no-op-safe
 * display when disabled) rather than a separate hand-rolled summary, so this
 * can never silently drift out of sync with what the patient actually sees
 * and fills in — same reasoning as SubmissionViewer's use of the doctor's own
 * tabs. Same 4 sections as PatientCaseForm (Personal info / Family history /
 * Medical history / Consent) either way — `layout` only changes how they're
 * arranged, not what's shown. No `<form>` wrapper of its own in either
 * layout (TabbedFormShell doesn't render one, and neither does the flat
 * layout), since this can end up nested inside the doctor's own outer
 * submission form.
 */
export function PatientCaseReadOnlyView({ data, employeeId, email, doctors, layout = 'tabs' }: PatientCaseReadOnlyViewProps) {
  const [tab, setTab] = useState<TabValue>('personal');

  const sections: (TabbedFormShellTab & { key: TabValue })[] = [
    {
      key: 'personal',
      label: 'Personal info',
      content: <PersonalInfoTab data={data} employeeId={employeeId} email={email} disabled />
    },
    {
      key: 'family',
      label: 'Family history',
      content: (
        <FamilyHistoryTab data={data} relatives={data.familyHistory.relatives} onAddRelative={() => {}} onRemoveRelative={() => {}} disabled />
      )
    },
    {
      key: 'medical',
      label: 'Medical history',
      content: <MedicalHistoryTab data={data} disabled />
    },
    {
      key: 'consent',
      label: 'Consent',
      content: (
        <ConsentTab
          data={data}
          doctors={doctors}
          disabled
          accepted={data.consent.accepted}
          onAcceptedChange={() => {}}
          signedBy={data.consent.signedBy}
          onSignedByChange={() => {}}
          onSignatureChange={() => {}}
          assignedClinicianId={data.assignedClinicianId}
          onAssignedClinicianChange={() => {}}
        />
      )
    }
  ];

  if (layout === 'flat') {
    return (
      <div className="flex flex-col gap-6">
        {sections.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? <Separator /> : null}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</p>
              {section.content}
            </div>
          </Fragment>
        ))}
      </div>
    );
  }

  return <TabbedFormShell tabs={sections} value={tab} onValueChange={(value) => setTab(value as TabValue)} />;
}
