import { View } from '@react-pdf/renderer';
import type { PatientCaseData } from '../../../patient-case-data';
import { PdfGridBox, type PdfGridCellDef } from './pdf-primitives';
import { pdfStyles } from './pdf-styles';

export interface PdfEmployeeSectionProps {
  candidate: { fullName: string; employeeId: string; dateOfBirth: string; email: string; contactNumber: string; position: string };
  patientCaseData: PatientCaseData | null;
}

/** Employee/candidate identity plus whatever the patient's own intake form added — one bordered grid, the same "boxed cells" the paper form's page 1 uses for this information, rather than plain spaced-out label/value text. */
export function PdfEmployeeSection({ candidate, patientCaseData }: PdfEmployeeSectionProps) {
  const personalInfo = patientCaseData?.personalInfo;
  const address = personalInfo
    ? [personalInfo.addressLine1, personalInfo.addressLine2, personalInfo.city, personalInfo.state, personalInfo.country].filter(Boolean).join(', ')
    : '';
  const phones = personalInfo?.phones.length ? personalInfo.phones.map((p) => `${p.type}: ${p.number}`).join('; ') : candidate.contactNumber;

  const rows: PdfGridCellDef[][] = [
    [
      { label: 'Name', value: candidate.fullName, weight: 2 },
      { label: 'NCB employee ID number', value: candidate.employeeId }
    ],
    [
      { label: 'Position applied for', value: candidate.position },
      { label: 'Date of birth', value: candidate.dateOfBirth },
      { label: 'Sex', value: personalInfo?.sex },
      { label: 'Marital status', value: personalInfo?.maritalStatus }
    ],
    [
      { label: 'Email', value: candidate.email },
      { label: 'Phone number(s)', value: phones },
      { label: 'Address', value: address, weight: 2 }
    ]
  ];

  if (patientCaseData?.primaryPhysicianName || patientCaseData?.emergencyContactName) {
    rows.push([
      { label: 'Primary doctor', value: patientCaseData.primaryPhysicianName },
      { label: "Doctor's phone number", value: patientCaseData.primaryPhysicianNumber }
    ]);
    rows.push([
      { label: 'In case of emergency contact', value: patientCaseData.emergencyContactName },
      { label: 'Phone number', value: patientCaseData.emergencyContactNumber }
    ]);
  }

  return (
    <View style={pdfStyles.sectionSpacing}>
      <PdfGridBox rows={rows} />
    </View>
  );
}
