# Medical Form UI/UX Requirements

## Implementation status

Verified against the current codebase. The core requirement — tabbed layout, profile/case
separation, role-scoped visibility — is built and matches this document closely:

- Patient tabs (§4): implemented 1:1 as Personal Info / Consent / Family History / Medical History
  (`apps/web/features/cases/components/patient-case-form/`).
- Doctor assessment tabs — listed in §11 as a *future* extension when this was written — are now
  built: Assessment / Physical Examination / Determination & Attestation
  (`apps/web/features/submissions/components/doctor-case-form/`), each independently role-gated
  (a delegate never sees Determination & Attestation, per §7's "should not" list).
- Position-applied-for bias concern (§7, doctor "should not" list): the position field is hidden
  from doctor/delegate viewers, not just de-emphasized (`hidePositionFromViewer` in
  `apps/web/features/cases/case-workspace-capabilities.ts`).
- Signature (§4.2): both typed-name and on-screen signature pad are supported; consent/signature
  are server-validated before submission is accepted, not just client-side (§9).
- Draft save (§5): supported, with autosave (`apps/web/lib/hooks/use-autosave.ts`) rather than a
  manual-only "Save Draft" button.
- Audit/traceability (§10): case-level audit events are recorded for submission, review, and
  status transitions; per-keystroke or per-field-edit granularity is not tracked (only save/submit
  events), which is coarser than a literal reading of §10 but consistent with the rest of the
  system's audit model.

The rest of this document is the original requirements text, kept as the reference for the design
intent above.

## Purpose
This document defines the user requirements (UR) for the **Medical Form** in the medical onboarding / medical case management system.

The medical form must be clearly separated from the patient profile and should be presented in a **tabbed layout** so each role sees only the sections relevant to them.

---

## 1. Form Design Overview

The medical form should be displayed in a **tabbed format** to improve usability, reduce cognitive load, and clearly separate sections of information.

### Goals
- Make the form easier to complete in stages
- Reduce clutter by showing information in grouped tabs
- Control visibility of sections based on role
- Prevent users from seeing or editing information outside their responsibility
- Allow the candidate/patient to complete only the areas relevant to them
- Allow the doctor to complete only the medical assessment areas relevant to them
- Allow HR to control workflow without exposing unnecessary medical details

---

## 2. Workflow Context

When an **HR Officer** creates a new medical case for a candidate/patient:

1. The HR Officer selects the candidate/patient
2. A new medical case is created and linked to that patient profile
3. The candidate/patient can log in and access the medical case
4. The candidate/patient sees only the tabs intended for them
5. Some information may already be pre-filled from their user profile
6. The candidate/patient can review and update allowed fields before submission
7. The medical case then moves through the defined workflow to the doctor’s office and later HR

---

## 3. Separation of Profile vs Medical Case

The system must distinguish between:

### A. Candidate/Patient Profile
This is the master profile record and may include:
- full name
- address
- contact number(s)
- email address
- emergency contact
- primary physician
- TRN / identification details
- other profile-level demographic data

### B. Medical Case
This is the case-specific medical process record and may include:
- consent for this medical
- family history
- medical history
- doctor assessment
- attachments
- case status
- assigned doctor’s office

### Requirement
The profile and the medical case must remain separate concepts in both:
- backend data structure
- frontend navigation
- permissions
- field editability

---

## 4. Candidate/Patient Tabs

When the candidate/patient opens the medical case, they should see only the tabs relevant to them.

## Required Candidate Tabs

### 4.1 Personal Information
This tab should display and allow editing of approved personal/profile-related fields for the case.

Suggested fields:
- Full Name
- Address
- Phone Number
- Email Address
- Emergency Contact Name
- Emergency Contact Number
- Primary Physician / Doctor
- Other allowed personal details as required

### Behavior
- Fields may be **pre-populated** from the candidate/patient profile when the account is created
- Candidate/patient should be able to edit only the approved fields
- Changes should update according to business rules:
  - either update case copy only
  - or update master profile if allowed by policy
- Protected identity/admin-controlled fields should not be editable unless explicitly allowed

---

### 4.2 Consent
This tab should capture the candidate/patient’s acknowledgement and consent for the medical process.

Suggested elements:
- consent statement text
- checkbox confirming agreement
- date of consent
- typed name for signature
- optional on-screen signature pad

### Signature Requirement
The system should support one or both of the following:
- candidate/patient types their full name as signature
- candidate/patient signs directly on screen

The signed/accepted consent should be stored as part of the medical case audit trail.

---

### 4.3 Family History
This tab should allow the candidate/patient to provide family medical history information.

Suggested structure:
- grouped medical conditions
- yes/no options
- notes/comments fields where necessary

Examples:
- hypertension
- diabetes
- heart disease
- asthma
- cancer
- other relevant hereditary conditions

This section should be easy to complete and clearly formatted.

---

### 4.4 Medical History
This tab should allow the candidate/patient to provide their own medical history.

Suggested structure:
- past illnesses
- surgeries
- allergies
- medications
- chronic conditions
- prior hospitalizations
- other relevant medical disclosures

This section should support:
- yes/no questions
- text areas for explanation
- date fields where required

---

## 5. Candidate/Patient Form UX Requirements

The candidate-facing medical form should:
- use clear tabs
- allow saving progress where appropriate
- clearly show required fields
- support validation before final submission
- show user-friendly error messages
- show a clear submit action only when candidate-required sections are complete
- allow draft save if draft workflow is supported

Recommended UX:
- top tab navigation or side tabs
- progress indicator
- clear “Save Draft” and “Submit” buttons
- confirmation message after successful save or submission

---

## 6. Profile Prepopulation Requirements

When a user account or candidate profile is created, the system should allow certain fields to be pre-set in the profile so they appear automatically in the Personal Information tab of the medical case.

Examples:
- name
- address
- phone number
- email address
- emergency contact
- primary physician

Requirement:
- pre-filled profile values should reduce re-entry
- candidate should be able to edit only approved fields
- any prepopulation logic should be consistent and auditable

---

## 7. Role-Based Visibility Rules for the Form

### Candidate/Patient
Should see only:
- Personal Information
- Consent
- Family History
- Medical History
- any other patient-completed sections explicitly allowed

Should **not** see:
- confidential doctor assessment details
- HR-only workflow/admin controls
- redundant internal routing details not meant for the patient

### Doctor / Doctor Office User
Should see:
- only the case sections needed for medical processing
- patient-provided information required to conduct the medical
- doctor assessment sections
- attachment upload if applicable

Should **not** be able to:
- edit patient master identity/profile data such as name, address, TRN, etc.
- view redundant routing details that add no value to doctor workflow

### HR Officer
Should see:
- case management controls
- workflow/routing controls
- high-level patient and case information needed operationally
- only the medical detail permitted by policy

### Admin
Should see:
- all sections and all controls, subject to system policy

---

## 8. Form Layout Recommendations

The medical form should be properly laid out with:
- clean tab structure
- grouped fields inside each tab
- consistent spacing
- clear labels
- clear required/optional indicators
- responsive layout
- section headings and helper text where needed

Recommended layout pattern:
- tab header at top
- section content below
- related fields grouped in cards or panels
- action buttons anchored consistently at the bottom

---

## 9. Validation Requirements

The system should validate:
- required personal information fields
- consent acknowledgement before submission
- family/medical history fields as required by business rules
- signature capture if signature is mandatory

Validation should happen:
- client side for usability
- server side for security and reliability

---

## 10. Audit and Traceability

The system should record:
- when the candidate opened the form
- when changes were made
- when consent was captured
- who submitted the candidate sections
- whether signature was typed or drawn
- timestamp of submission

---

## 11. Suggested Future Extension

Later, the tab structure can be extended for:
- doctor assessment tabs
- lab results
- attachments
- HR review summary
- case history / audit timeline

These should remain role-controlled and not automatically visible to the candidate.

---

## 12. Summary of Core Requirement

The medical form must:
- be presented in a tabbed format
- separate patient profile information from case-specific medical information
- allow HR to initiate the medical case
- allow the candidate/patient to complete only their sections
- pre-fill approved profile fields where possible
- support consent and signature capture
- support family history and medical history sections
- enforce strict role-based visibility and edit rights
