'use strict';

const app = document.querySelector('#app');

const state = {
  user: null,
  csrfToken: '',
  session: null,
  sessionTimers: {
    warning: null,
    timeout: null
  },
  timeoutMessage: '',
  submissions: [],
  users: [],
  candidates: [],
  cases: [],
  clinicians: [],
  reviewers: [],
  medicalOffices: [],
  monthlyReport: [],
  auditEntries: [],
  databaseStatus: null,
  medicalOfficeSearch: '',
  selectedMedicalOfficeId: '',
  medicalOfficeCaseSearch: '',
  medicalOfficeCasePage: 1,
  doctorManagementSearch: '',
  selectedManagedDoctorId: '',
  doctorManagementCaseSearch: '',
  doctorManagementCasePage: 1,
  reviewQueueSearch: '',
  selectedReviewCaseId: '',
  reviewQueueSubmission: null,
  reviewQueueSubmissionId: '',
  reviewQueueLoaded: false,
  reviewQueueMessage: '',
  showCreateMedicalOfficeModal: false,
  editingMedicalOfficeId: '',
  archiveQuery: '',
  userSearch: '',
  reportFilters: {
    query: '',
    startDate: '',
    endDate: '',
    stage: '',
    doctorQuery: '',
    medicalOfficeQuery: '',
    paymentStatus: ''
  },
  reportDrilldown: null,
  reportSection: 'overview',
  reportVisibleFilters: ['query', 'date', 'stage', 'paymentStatus'],
  reportChartConfigs: [],
  reportChartInstances: [],
  patientReportStats: { total: 0, linked: 0 },
  reportUserStats: { doctors: 0, clinicians: 0, offices: 0 },
  caseSearch: '',
  casePatientSearch: '',
  casePatientPage: 1,
  caseOfficeSearch: '',
  selectedCaseOfficeId: '',
  casePage: 1,
  showNewCaseForm: false,
  selectedCaseWorkspaceId: '',
  caseWorkspaceSubmission: null,
  caseWorkspaceSubmissionId: '',
  detailModal: null,
  editingManagedUserId: '',
  deletingManagedUserId: '',
  showCreateManagedUserModal: false,
  managedUserPrefill: null,
  userManagementMessage: '',
  settings: {
    organizationName: 'National Commercial Bank Jamaica Limited',
    appName: 'National Commercial Bank Jamaica Medical Platform',
    clinicianIntro: 'Complete the new-hire medical assessment and submit it directly to National Commercial Bank Jamaica for confidential review.',
    reviewerIntro: 'Review submitted new-hire medical assessments, update review status, and print or file authorized forms.',
    confidentialityNotice: 'Confidential medical information. Access is restricted to authorized medical facilities and National Commercial Bank Jamaica reviewers.',
    notificationEmail: 'hr-review@ncb.local',
    doctorNotificationEmail: '',
    supportContact: 'hr-review@ncb.local',
    primaryColor: '#005baa',
    accentColor: '#ffd200',
    themeColors: {
      background: '#f6f7f8',
      surface: '#ffffff',
      secondarySurface: '#eaf3ff',
      text: '#17202a',
      mutedText: '#5d6975',
      border: '#d9e1e5',
      primary: '#005baa',
      accent: '#ffd200',
      danger: '#b42318'
    },
    smallLogoDataUrl: '',
    largeLogoDataUrl: '',
    auth: {
      mode: 'local',
      ldapEnabled: false,
      ldapUrl: '',
      ldapBaseDn: '',
      ldapBindDn: '',
      ldapUserFilter: '',
      samlEnabled: false,
      samlEntryPoint: '',
      samlIssuer: '',
      samlCertificate: ''
    },
    mail: {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      rejectUnauthorized: true,
      username: '',
      password: '',
      fromEmail: 'no-reply@localhost'
    },
    emailTemplates: {
      accountCreated: {
        subject: '{{appName}}: your account has been created',
        body: 'Hello {{displayName}},\n\nYour account for {{appName}} has been created.\n\nSign in: {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{temporaryPassword}}\n\nYou will be required to choose a new password after signing in.'
      },
      passwordReset: {
        subject: '{{appName}}: reset your password',
        body: 'Hello {{displayName}},\n\nA password reset was requested for your {{appName}} account.\n\nReset your password: {{resetUrl}}\n\nThis link expires in {{expiryMinutes}} minutes.'
      },
      medicalAssignedToPatient: {
        subject: '{{appName}}: medical form ready for completion',
        body: 'Hello {{displayName}},\n\nA medical form is ready for you in {{appName}}.\n\nSign in to complete it: {{loginUrl}}'
      }
    },
    operations: {
      auditRetentionDays: 365,
      loginWindowMinutes: 15,
      loginMaxAttempts: 5,
      sessionTimeoutMinutes: 15,
      rateLimitPerMinute: 120,
      dailyDigestTime: '08:00',
      timezone: 'America/Jamaica'
    },
    database: {
      source: 'environment',
      enabled: false,
      provider: 'postgres',
      cloudSqlDialect: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      database: 'ncb_medical',
      user: '',
      password: '',
      socketPath: '',
      sslMode: 'require',
      sslCa: '',
      sslCert: '',
      sslKey: '',
      autoMigrate: true,
      autoCreate: false,
      poolMin: 0,
      poolMax: 10,
      idleTimeoutMs: 30000,
      connectTimeoutMs: 10000,
      statementTimeoutMs: 30000
    },
    formTemplate: null
  },
  selectedSubmission: null,
  selectedCase: null,
  selectedDoctorCaseId: '',
  doctorReportRows: [],
  doctorReportPagination: { total: 0, limit: 10, offset: 0, hasMore: false },
  doctorReportSummary: {
    processed: 0,
    processedThisMonth: 0,
    pendingHrReview: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    paidCount: 0,
    followUpCount: 0,
    averageTurnaroundHours: 0
  },
  doctorReportSearch: '',
  doctorReportStatus: '',
  doctorReportPaymentStatus: '',
  doctorReportPage: 1,
  doctorReportLoading: false,
  doctorReportLoaded: false,
  doctorReportError: '',
  selectedDoctorReportCaseId: '',
  selectedDoctorReportCase: null,
  selectedDoctorReportSubmission: null,
  doctorWorkspaceLoaded: false,
  hrModuleLoaded: false,
  reportManagementLoaded: false,
  patientManagementLoaded: false,
  sidebarCollapsed: false,
  appTheme: ['light', 'dark'].includes(localStorage.getItem('ncbAppTheme')) ? localStorage.getItem('ncbAppTheme') : 'light',
  adminModule: 'forms',
  systemSettingsTab: 'general',
  formBuilderSelectedStepId: '',
  formBuilderSelectedFieldId: '',
  prefillPatientId: '',
  selectedPatientId: '',
  patientSearch: '',
  patientUserMessage: '',
  editingPatientId: '',
  editingSubmissionRecord: null,
  view: 'submit'
};

const ROLES = Object.freeze({
  ADMIN: 'admin',
  REVIEWER: 'reviewer',
  DOCTOR: 'clinician',
  PATIENT: 'patient'
});

const PERMISSIONS = Object.freeze({
  AUTH_READ: 'auth:read',
  SESSION_LOGOUT: 'session:logout',
  SUBMISSIONS_LIST: 'submissions:list',
  SUBMISSIONS_CREATE: 'submissions:create',
  SUBMISSIONS_VIEW: 'submissions:view',
  SUBMISSIONS_FOLLOW_UP: 'submissions:follow_up',
  SUBMISSIONS_REVIEW: 'submissions:review',
  SUBMISSIONS_DOWNLOAD: 'submissions:download',
  MEDICAL_CASES_LIST: 'medical_cases:list',
  MEDICAL_CASES_CREATE: 'medical_cases:create',
  MEDICAL_CASES_UPDATE: 'medical_cases:update',
  MEDICAL_CASES_PATIENT_UPDATE: 'medical_cases:patient_update',
  PATIENT_PROFILES_LIST: 'patient_profiles:list',
  PATIENT_PROFILES_CREATE: 'patient_profiles:create',
  PATIENT_PROFILES_UPDATE: 'patient_profiles:update',
  DOCTORS_LIST: 'doctors:list',
  DOCTORS_CREATE: 'doctors:create',
  REVIEWERS_LIST: 'reviewers:list',
  REVIEWERS_CREATE: 'reviewers:create',
  REPORTS_VIEW: 'reports:view',
  NOTIFICATIONS_MANAGE: 'notifications:manage',
  SETTINGS_MANAGE: 'settings:manage',
  USERS_MANAGE: 'users:manage'
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.REVIEWER]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_REVIEW,
    PERMISSIONS.SUBMISSIONS_DOWNLOAD,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_CREATE,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_CREATE,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.DOCTORS_LIST,
    PERMISSIONS.DOCTORS_CREATE,
    PERMISSIONS.REVIEWERS_LIST,
    PERMISSIONS.REVIEWERS_CREATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_MANAGE
  ]),
  [ROLES.DOCTOR]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.SUBMISSIONS_LIST,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_VIEW,
    PERMISSIONS.SUBMISSIONS_FOLLOW_UP,
    PERMISSIONS.SUBMISSIONS_DOWNLOAD,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_UPDATE
  ]),
  [ROLES.PATIENT]: Object.freeze([
    PERMISSIONS.AUTH_READ,
    PERMISSIONS.SESSION_LOGOUT,
    PERMISSIONS.MEDICAL_CASES_LIST,
    PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE,
    PERMISSIONS.PATIENT_PROFILES_LIST,
    PERMISSIONS.PATIENT_PROFILES_UPDATE,
    PERMISSIONS.DOCTORS_LIST
  ])
});

const CASE_ROUTES = Object.freeze({
  PATIENT: 'patient',
  DOCTOR: 'doctor'
});

const statusLabels = {
  fit: 'Fit',
  fit_with_restrictions: 'Fit with restrictions',
  temporarily_deferred: 'Temporarily deferred',
  not_fit: 'Not fit',
  pending: 'Pending review',
  reviewed: 'Reviewed',
  needs_follow_up: 'Needs follow-up',
  archived: 'Archived'
};

const caseStatusLabels = {
  draft: 'Draft',
  sent_to_patient: 'Sent to patient',
  patient_completed: 'Patient completed',
  sent_to_doctor: 'Sent to doctor office',
  doctor_submitted: 'Doctor submitted',
  review_pending: 'Pending HR review',
  reviewed: 'Reviewed',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
  canceled_by_doctor: 'Canceled by doctor'
};

const physicianExamSections = Object.freeze([
  {
    title: 'General Appearance',
    fields: [
      ['generalAppearance', 'General appearance'],
      ['height', 'Height'],
      ['weight', 'Weight']
    ]
  },
  {
    title: 'Nose-Mouth-Neck',
    fields: [
      ['nose', 'Nose'],
      ['pharynx', 'Pharynx'],
      ['teeth', 'Teeth'],
      ['tongue', 'Tongue'],
      ['tonsils', 'Tonsils'],
      ['thyroid', 'Thyroid']
    ]
  },
  {
    title: 'Cardiovascular System',
    help: 'Please enter numerical values for pulse and blood pressure.',
    fields: [
      ['pulseRate', 'Pulse rate'],
      ['rhythm', 'Rhythm'],
      ['bloodPressure', 'Blood pressure'],
      ['varicoseVeins', 'Varicose veins'],
      ['presenceOfCyanosis', 'Presence of cyanosis'],
      ['mucusMembrane', 'Mucus membrane']
    ]
  },
  {
    title: 'Respiratory System',
    fields: [
      ['thorax', 'Thorax'],
      ['breasts', 'Breasts']
    ]
  },
  {
    title: 'Nervous System',
    fields: [
      ['fundi', 'Fundi'],
      ['reflexes', 'Reflexes'],
      ['sensation', 'Sensation'],
      ['tremors', 'Tremors']
    ]
  },
  {
    title: 'Mental State',
    fields: [
      ['mentalAppearance', 'Appearance'],
      ['behaviour', 'Behaviour']
    ]
  },
  {
    title: 'Genito-Urinary System',
    fields: [
      ['kidneys', 'Kidneys'],
      ['organs', 'Organs']
    ]
  },
  {
    title: 'Skeletal System',
    fields: [
      ['skull', 'Skull'],
      ['spine', 'Spine'],
      ['upperExtremities', 'Upper extremities'],
      ['lowerExtremities', 'Lower extremities']
    ]
  },
  {
    title: 'Disabilities',
    fields: [
      ['disabilities', 'Disabilities', 'textarea']
    ]
  },
  {
    title: 'Pregnancy Test',
    fields: [
      ['pregnancyTest', 'Pregnancy test']
    ]
  }
]);

const physicianExamFieldKeys = Object.freeze(physicianExamSections.flatMap((section) => section.fields.map(([key]) => key)));

const formBuilderRoles = Object.freeze(['admin', 'reviewer', 'clinician', 'patient']);
const configurableFieldTypes = Object.freeze(['text', 'textarea', 'date', 'number', 'email', 'phone', 'select', 'radio', 'checkbox', 'yes_no', 'information']);

function defaultProcessSteps() {
  return [
    {
      id: 'hr_create_medical',
      label: 'HR creates medical',
      surface: 'hr',
      description: 'HR creates a medical case and sends it to the patient or directly to the doctor office.',
      builtIn: true,
      active: true
    },
    {
      id: 'patient_complete_medical',
      label: 'Patient completes medical',
      surface: 'patient',
      description: 'Patient reviews disclosure, completes their sections, signs, and submits to a doctor office.',
      builtIn: true,
      active: true
    },
    {
      id: 'doctor_complete_assessment',
      label: 'Doctor completes assessment',
      surface: 'doctor',
      description: 'Doctor or clinician reviews patient details, completes the physician assessment, signs, and submits to HR.',
      builtIn: true,
      active: true
    },
    {
      id: 'hr_review_complete',
      label: 'HR reviews and completes',
      surface: 'hr',
      description: 'HR reviews the submitted medical, completes the process, and later marks billing status as paid when applicable.',
      builtIn: true,
      active: true
    }
  ];
}

function defaultStepForSurface(surface) {
  return {
    hr: 'hr_create_medical',
    patient: 'patient_complete_medical',
    doctor: 'doctor_complete_assessment'
  }[surface] || 'hr_create_medical';
}

function defaultFormTemplate() {
  const baseRoles = [...formBuilderRoles];
  const doctorRoles = ['admin', 'clinician'];
  const patientRoles = ['admin', 'patient'];
  const hrRoles = ['admin', 'reviewer'];
  const systemFields = [
    ...[
      ['patient', 'Personal & consent', 'personalInfo.firstName', 'First name', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.middleInitial', 'Middle initial', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.lastName', 'Last name', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.sex', 'Sex', 'select', patientRoles, ['Male', 'Female']],
      ['patient', 'Personal & consent', 'personalInfo.maritalStatus', 'Marital status', 'select', patientRoles, ['Single', 'Married', 'Divorced', 'Widowed']],
      ['patient', 'Personal & consent', 'personalInfo.addressLine1', 'Address line 1', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.addressLine2', 'Address line 2', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.cityTown', 'City/Town', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.parish', 'Parish', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.country', 'Country', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.homePhone', 'Home phone', 'phone', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.mobilePhone', 'Mobile phone', 'phone', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.workPhone', 'Work phone', 'phone', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.primaryPhysician', 'Primary doctor name', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.primaryPhysicianAddress', 'Primary doctor address', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.primaryPhysicianPhone', 'Primary doctor phone', 'phone', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.emergencyContactName', 'Emergency contact name', 'text', patientRoles],
      ['patient', 'Personal & consent', 'personalInfo.emergencyContactNumber', 'Emergency contact number', 'phone', patientRoles],
      ['patient', 'Personal & consent', 'consent.accepted', 'Consent accepted', 'checkbox', patientRoles],
      ['patient', 'Personal & consent', 'consent.signedBy', 'Consent signed by', 'text', patientRoles],
      ['patient', 'Medical history', 'assignedClinicianId', 'Medical office', 'select', patientRoles]
    ],
    ...physicianExamSections.flatMap((section) => section.fields.map(([key, label, type]) => [
      'doctor',
      section.title,
      `physicalExam.${key}`,
      label,
      type || 'text',
      doctorRoles
    ])),
    ...[
      ['doctor', 'Examining physician information', 'assessment.facilityName', 'Medical facility', 'text', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.assessmentDate', 'Assessment date', 'date', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.facilityAddress', 'Facility address', 'text', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.clinicianName', 'Clinician name', 'text', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.clinicianRegistrationNumber', 'Registration number', 'text', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.telephoneNumber', 'Telephone No.', 'phone', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.faxNumber', 'Fax No.', 'phone', doctorRoles],
      ['doctor', 'Examining physician information', 'assessment.emailAddress', 'E-mail address', 'email', doctorRoles],
      ['doctor', 'Laboratory', 'labResults.additionalTests', 'Laboratory', 'textarea', doctorRoles],
      ['doctor', 'Conclusions', 'determination.conclusions', 'Conclusions', 'textarea', doctorRoles],
      ['doctor', 'Conclusions', 'determination.status', 'Applicable box', 'select', doctorRoles, ['Cleared Fit For Employment on Medical Grounds', 'Not Fit For Employment on Medical Grounds']],
      ['doctor', 'Attachments & signature', 'attestation.signedBy', 'Signed by', 'text', doctorRoles],
      ['doctor', 'Attachments & signature', 'attestation.signatureDate', 'Signature date', 'date', doctorRoles],
      ['doctor', 'Attachments & signature', 'attestation.consentConfirmed', 'Consent confirmation', 'checkbox', doctorRoles],
      ['hr', 'Case creation', 'patientId', 'Patient', 'select', hrRoles],
      ['hr', 'Case creation', 'route', 'Routing', 'select', hrRoles, ['Send to patient first', 'Send directly to doctor office']],
      ['hr', 'Case creation', 'assignedClinicianId', 'Doctor office', 'select', hrRoles]
    ]
  ];
  return {
    version: 1,
    updatedAt: '',
    processSteps: defaultProcessSteps(),
    fields: systemFields.map(([surface, section, name, label, type, roles, options = []]) => ({
      id: `sys_${surface}_${name.replace(/[^a-z0-9]+/gi, '_')}`,
      builtIn: true,
      active: true,
      stepId: defaultStepForSurface(surface),
      surface,
      section,
      name,
      label,
      type,
      options,
      visibleRoles: roles,
      editableRoles: roles,
      requiredRoles: []
    }))
  };
}

document.addEventListener('DOMContentLoaded', init);
['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((eventName) => {
  document.addEventListener(eventName, refreshSessionFromWarningActivity, { passive: true });
});

async function init() {
  try {
    await loadPublicSettings();
    const response = await api('/api/me');
    state.user = response.user;
    state.csrfToken = response.csrfToken;
    state.session = response.session || null;
    resetRoleWorkspaceState();
    state.settings = { ...state.settings, ...(response.settings || {}) };
    applyTheme();
    startSessionTimers();
    if (response.user.mustChangePassword) {
      renderForcedPasswordChange();
      return;
    }
    state.view = defaultViewForUser();
    if (can(PERMISSIONS.SUBMISSIONS_LIST)) await loadSubmissions();
    renderShell();
  } catch {
    await loadPublicSettings().catch(() => {});
    renderLogin();
  }
}

async function loadPublicSettings() {
  const response = await api('/api/public-settings');
  state.settings = { ...state.settings, ...(response.settings || {}) };
  applyTheme();
}

function applyTheme() {
  const colors = state.settings.themeColors || {};
  const isDark = state.appTheme === 'dark';
  const primary = colors.primary || state.settings.primaryColor || '#005baa';
  const accent = colors.accent || state.settings.accentColor || '#ffd200';
  const danger = colors.danger || '#b42318';
  const bg = isDark ? '#101214' : colors.background || '#f6f7f8';
  const surface = isDark ? '#181a1c' : colors.surface || '#ffffff';
  const surface2 = isDark ? '#202326' : colors.secondarySurface || '#eaf3ff';
  const text = isDark ? '#f2f4f7' : colors.text || '#17202a';
  const muted = isDark ? '#a7b0bb' : colors.mutedText || '#5d6975';
  const border = isDark ? '#30343a' : colors.border || '#d9e1e5';
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--surface', surface);
  document.documentElement.style.setProperty('--surface-2', surface2);
  document.documentElement.style.setProperty('--text', text);
  document.documentElement.style.setProperty('--muted', muted);
  document.documentElement.style.setProperty('--border', border);
  document.documentElement.style.setProperty('--accent', primary);
  document.documentElement.style.setProperty('--primary', primary);
  document.documentElement.style.setProperty('--accent-2', accent);
  document.documentElement.style.setProperty('--danger', danger);
  document.documentElement.style.setProperty('--input-bg', isDark ? '#131517' : surface);
  document.documentElement.style.setProperty('--surface-hover', isDark ? '#24272c' : surface2);
  document.documentElement.style.setProperty('--surface-active', isDark ? '#1d2a38' : surface2);
  document.documentElement.style.setProperty('--focus-ring', `color-mix(in srgb, ${primary} 20%, transparent)`);
  document.documentElement.style.setProperty('--danger-bg', `color-mix(in srgb, ${danger} ${isDark ? 18 : 9}%, ${surface})`);
  document.documentElement.style.setProperty('--danger-border', `color-mix(in srgb, ${danger} 38%, ${border})`);
  document.documentElement.style.setProperty('--warning-bg', `color-mix(in srgb, ${accent} ${isDark ? 16 : 22}%, ${surface})`);
  document.documentElement.style.setProperty('--warning-border', `color-mix(in srgb, ${accent} 48%, ${border})`);
  document.documentElement.style.setProperty('--success-bg', `color-mix(in srgb, #16a34a ${isDark ? 18 : 12}%, ${surface})`);
  document.documentElement.style.setProperty('--success-border', `color-mix(in srgb, #16a34a 42%, ${border})`);
  document.documentElement.style.setProperty('--success-text', isDark ? '#bbf7d0' : '#166534');
  document.documentElement.dataset.theme = state.appTheme;
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = state.csrfToken;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401 && state.user) {
      expireSession(data.error || 'Session expired. Please sign in again.');
    }
    throw new Error(data.error || 'Request failed.');
  }
  if (data.session) {
    state.session = data.session;
    startSessionTimers();
  } else if (state.user && path !== '/api/logout' && path !== '/api/public-settings') {
    startSessionTimers();
  }
  return data;
}

function debounce(callback, wait = 250) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      Promise.resolve(callback(...args)).catch((error) => console.error(error));
    }, wait);
  };
}

function renderLogin() {
  state.user = null;
  state.csrfToken = '';
  state.session = null;
  resetRoleWorkspaceState();
  clearSessionTimers();
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  if (resetToken) {
    renderPasswordResetConfirm(resetToken);
    return;
  }
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel" aria-labelledby="login-title">
        <div class="login-brand">
          ${renderBrandSymbol('large')}
          <div class="login-brand-text">
            <strong>${escapeHtml(state.settings.organizationName)}</strong>
          </div>
        </div>
        <div class="login-heading">
          <h1 id="login-title">${escapeHtml(state.settings.appName)}</h1>
          <p>Please enter your credentials.</p>
        </div>
        <form id="loginForm" class="form-stack">
          ${state.timeoutMessage ? `<div class="notice is-quiet" role="status">${escapeHtml(state.timeoutMessage)}</div>` : ''}
          <div class="field login-field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" placeholder="eg DoeJ@gmail.com" required>
          </div>
          <div class="field login-field">
            <label for="password">Password</label>
            <div class="password-shell">
              <input id="password" name="password" type="password" autocomplete="current-password" required>
              <button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">
                ${navIcon('eye')}
              </button>
            </div>
          </div>
          <div id="loginError" class="error" role="alert"></div>
          <button class="primary-btn" type="submit">Sign in</button>
          <button class="login-link" type="button" data-action="forgot-password"><span>Can&apos;t sign in?</span> <strong>Click here request a password.</strong></button>
        </form>
        <form id="forgotForm" class="form-stack forgot-panel" hidden>
          <div class="field">
            <label for="resetEmail">Account email</label>
            <input id="resetEmail" name="email" type="email" autocomplete="email" required>
          </div>
          <div id="forgotMessage" class="notice is-quiet" role="status"></div>
          <div class="toolbar">
            <button class="secondary-btn" type="button" data-action="back-login">Back</button>
            <button class="primary-btn" type="submit">Request reset</button>
          </div>
        </form>
      </section>
    </main>
  `;

  const loginForm = document.querySelector('#loginForm');
  const forgotForm = document.querySelector('#forgotForm');

  document.querySelector('[data-action="forgot-password"]').addEventListener('click', () => {
    forgotForm.hidden = false;
    loginForm.hidden = true;
    forgotForm.email.value = loginForm.email.value;
  });

  document.querySelector('[data-action="back-login"]').addEventListener('click', () => {
    loginForm.hidden = false;
    forgotForm.hidden = true;
  });
  document.querySelector('[data-action="toggle-password"]').addEventListener('click', (event) => {
    const input = document.querySelector('#password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#forgotMessage');
    message.textContent = '';
    const submit = forgotForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const response = await api('/api/password-reset-request', {
        method: 'POST',
        body: { email: forgotForm.email.value }
      });
      message.textContent = response.message;
    } catch (err) {
      message.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#loginError');
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    error.classList.remove('is-visible');

    try {
      const response = await api('/api/login', {
        method: 'POST',
        body: {
          email: form.email.value,
          password: form.password.value
        }
      });
      state.user = response.user;
      state.csrfToken = response.csrfToken;
      state.session = response.session || null;
      resetRoleWorkspaceState();
      state.timeoutMessage = '';
      if (response.user.mustChangePassword) {
        startSessionTimers();
        renderForcedPasswordChange();
        return;
      }
      state.view = defaultViewForUser();
      startSessionTimers();
      if (can(PERMISSIONS.SUBMISSIONS_LIST)) await loadSubmissions();
      renderShell();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add('is-visible');
    } finally {
      submit.disabled = false;
    }
  });
}

function renderPasswordResetConfirm(token) {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel" aria-labelledby="reset-title">
        <div class="login-brand">${renderBrandSymbol('large')}</div>
        <div class="login-heading">
          <h1 id="reset-title">Reset password</h1>
          <p>Choose a new password for your account.</p>
        </div>
        <form id="resetPasswordForm" class="form-stack">
          ${passwordInputField('newPassword', 'New password', 'new-password')}
          ${passwordInputField('confirmPassword', 'Confirm new password', 'new-password')}
          <div id="resetPasswordMessage" class="notice is-quiet" role="status"></div>
          <button class="primary-btn" type="submit">Reset password</button>
        </form>
      </section>
    </main>
  `;
  bindPasswordVisibility(app);
  document.querySelector('#resetPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('#resetPasswordMessage');
    const submit = form.querySelector('button[type="submit"]');
    if (form.newPassword.value !== form.confirmPassword.value) {
      message.textContent = 'The passwords do not match.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Resetting...';
    try {
      const response = await api('/api/password-reset-confirm', {
        method: 'POST',
        body: { token, newPassword: form.newPassword.value }
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      state.timeoutMessage = response.message;
      renderLogin();
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Reset password';
    }
  });
}

function renderForcedPasswordChange() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel" aria-labelledby="change-password-title">
        <div class="login-brand">${renderBrandSymbol('large')}</div>
        <div class="login-heading">
          <h1 id="change-password-title">Choose a new password</h1>
          <p>Your temporary password must be changed before continuing.</p>
        </div>
        <form id="forcedPasswordForm" class="form-stack">
          ${passwordInputField('currentPassword', 'Temporary password', 'current-password')}
          ${passwordInputField('newPassword', 'New password', 'new-password')}
          ${passwordInputField('confirmPassword', 'Confirm new password', 'new-password')}
          <div id="forcedPasswordMessage" class="notice is-quiet" role="status"></div>
          <button class="primary-btn" type="submit">Change password</button>
          <button class="secondary-btn" type="button" data-action="forced-password-logout">Sign out</button>
        </form>
      </section>
    </main>
  `;
  bindPasswordVisibility(app);
  document.querySelector('[data-action="forced-password-logout"]')?.addEventListener('click', logout);
  document.querySelector('#forcedPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('#forcedPasswordMessage');
    const submit = form.querySelector('button[type="submit"]');
    if (form.newPassword.value !== form.confirmPassword.value) {
      message.textContent = 'The new passwords do not match.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Changing...';
    try {
      const response = await api('/api/change-password', {
        method: 'POST',
        body: {
          currentPassword: form.currentPassword.value,
          newPassword: form.newPassword.value
        }
      });
      state.user = response.user;
      state.view = defaultViewForUser();
      if (can(PERMISSIONS.SUBMISSIONS_LIST)) await loadSubmissions();
      renderShell();
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Change password';
    }
  });
}

function passwordInputField(name, label, autocomplete) {
  return `
    <div class="field login-field">
      <label for="${escapeHtml(name)}">${escapeHtml(label)}</label>
      <div class="password-shell">
        <input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" required>
        <button type="button" class="password-toggle" data-password-toggle="${escapeHtml(name)}" aria-label="Show password">${navIcon('eye')}</button>
      </div>
    </div>
  `;
}

function bindPasswordVisibility(root = document) {
  root.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = root.querySelector(`#${cssEscape(button.dataset.passwordToggle)}`);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}

async function loadSubmissions() {
  const response = await api('/api/submissions');
  state.submissions = response.submissions || [];
}

function renderShell() {
  const initials = getInitials(state.user.displayName);
  const accountSubtitle = profileSubtitle();
  app.innerHTML = `
    <div class="shell ${state.sidebarCollapsed ? 'is-sidebar-collapsed' : ''} theme-${escapeHtml(state.appTheme)}">
      <header class="topbar">
        <div class="topbar-left">
          <button class="topbar-menu-button" type="button" data-action="toggle-sidebar" aria-label="${state.sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}">
            <span aria-hidden="true">${navIcon('menu')}</span>
          </button>
          <div class="topbar-brand">
            ${renderBrandSymbol()}
            <span>${escapeHtml(state.settings.appName)}</span>
          </div>
        </div>
        <div class="topbar-right">
          <button type="button" class="topbar-icon-button" data-action="toggle-theme" title="Toggle ${state.appTheme === 'dark' ? 'light' : 'dark'} mode" aria-label="Toggle ${state.appTheme === 'dark' ? 'light' : 'dark'} mode">
            ${navIcon(state.appTheme === 'dark' ? 'sun' : 'moon')}
          </button>
          <div class="user-menu">
            <button class="user-chip" type="button" data-action="toggle-user-menu" aria-expanded="false" aria-label="Open profile menu">
              <span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span>
            </button>
            <div class="user-dropdown" id="userDropdown" hidden>
              <div class="user-dropdown-header">
                <span class="avatar is-large" aria-hidden="true">${escapeHtml(initials)}</span>
                <div>
                  <strong>${escapeHtml(state.user.displayName)}</strong>
                  <span>${escapeHtml(state.user.email)}</span>
                  ${accountSubtitle ? `<span>${escapeHtml(accountSubtitle)}</span>` : ''}
                </div>
              </div>
              <div class="user-dropdown-divider"></div>
              <button type="button" data-view="profile"><span>Profile</span></button>
              <button type="button" data-action="logout"><span>Sign out</span></button>
            </div>
          </div>
        </div>
      </header>
      <aside class="sidebar">
        <nav class="nav-stack" aria-label="Primary">
          ${renderPrimaryNav()}
          ${can(PERMISSIONS.DOCTORS_CREATE) && ![ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role) ? `
            ${navButton('setup', 'Patient Management', 'P')}
          ` : ''}
          ${can(PERMISSIONS.USERS_MANAGE) && ![ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role) ? `
            ${navButton('admin', 'Administration', 'A')}
          ` : ''}
        </nav>
        <div class="sidebar-footer">
          <button type="button" class="sidebar-tool" data-view="profile" title="Profile" aria-label="Profile">
            ${navIcon('settings')}
            <span class="nav-label">Profile</span>
          </button>
        </div>
      </aside>
      <main class="main">
        <section class="content" id="content"></section>
      </main>
    </div>
  `;

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      state.selectedSubmission = null;
      state.selectedCase = null;
      state.editingSubmissionRecord = null;
      renderShell();
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach((button) => button.addEventListener('click', logout));
  document.querySelector('[data-action="toggle-sidebar"]')?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    renderShell();
  });
  document.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => {
    state.appTheme = state.appTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ncbAppTheme', state.appTheme);
    applyTheme();
    renderShell();
  });
  document.querySelectorAll('[data-action="toggle-user-menu"]').forEach((menuButton) => menuButton.addEventListener('click', () => {
    const dropdown = document.querySelector('#userDropdown');
    dropdown.hidden = !dropdown.hidden;
    document.querySelectorAll('[data-action="toggle-user-menu"]').forEach((button) => {
      button.setAttribute('aria-expanded', String(!dropdown.hidden));
    });
  }));
  bindGlobalPatientSearch();
  renderContent();
}

function renderPrimaryNav() {
  if (state.user.role === ROLES.DOCTOR) {
    return [
      navButton('doctor-dashboard', 'Dashboard', 'D'),
      navButton('doctor-reports', 'Reports', 'R')
    ].join('');
  }
  if ([ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    return [
      navButton('hr-dashboard', 'Dashboard', 'D'),
      navButton('user-management', 'User Management', 'U'),
      navButton('setup', 'Patient Management', 'P'),
      navButton('medical-offices', 'Medical Office Management', 'M'),
      navButton('doctor-management', 'Doctor Management', 'T'),
      navButton('cases', 'Case/Medicals', 'C'),
      navButton('report-management', 'Report Management', 'R'),
      can(PERMISSIONS.SUBMISSIONS_REVIEW) ? navButton('review', 'Review queue', 'Q') : '',
      can(PERMISSIONS.USERS_MANAGE) ? navButton('admin', 'Administration', 'A') : ''
    ].join('');
  }
  if (can(PERMISSIONS.SUBMISSIONS_CREATE)) {
    return [navButton('submit', 'New assessment', 'N'), navButton('mine', 'Submitted records', 'S')].join('');
  }
  if (can(PERMISSIONS.SUBMISSIONS_REVIEW)) {
    return [navButton('review', 'Review queue', 'Q'), navButton('cases', 'Medical cases', 'C'), navButton('archive', 'Archive', 'A')].join('');
  }
  return navButton('my-medicals', 'My Medicals', 'M');
}

function navButton(view, label, icon) {
  return `
    <button class="nav-button ${state.view === view ? 'is-active' : ''}" data-view="${escapeHtml(view)}" title="${escapeHtml(label)}">
      <span class="nav-icon" aria-hidden="true">${navIcon(icon)}</span>
      <span class="nav-label">${escapeHtml(label)}</span>
    </button>
  `;
}

function renderBrandSymbol(size = 'small') {
  const source = size === 'large'
    ? state.settings.largeLogoDataUrl || state.settings.smallLogoDataUrl
    : state.settings.smallLogoDataUrl || state.settings.largeLogoDataUrl;
  if (source) {
    return `<span class="brand-symbol has-image" aria-hidden="true"><img src="${escapeHtml(source)}" alt=""></span>`;
  }
  return '<span class="brand-symbol" aria-hidden="true">NCB</span>';
}

function navIcon(key) {
  const icons = {
    D: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
    I: '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    C: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z"/><path d="M4 7l3-3h5l2 3"/></svg>',
    R: '<svg viewBox="0 0 24 24"><path d="M5 19V5"/><path d="M5 19h15"/><path d="M9 16v-5M13 16V8M17 16v-3"/></svg>',
    '$': '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M17 7.5c-.8-1.3-2.3-2-4.2-2H11a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2c-1.9 0-3.4-.7-4.2-2"/></svg>',
    P: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
    M: '<svg viewBox="0 0 24 24"><path d="M4 8h16v11H4z"/><path d="M8 8V5h8v3"/><path d="M9 13h6"/></svg>',
    Q: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    A: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z"/><path d="M9 12l2 2 4-5"/></svg>',
    N: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    S: '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="M8 12l3 3 5-6"/></svg>',
    T: '<svg viewBox="0 0 24 24"><path d="M8 4v7a4 4 0 0 0 8 0V4"/><path d="M6 4h4M14 4h4"/><path d="M12 15v2a3 3 0 0 0 3 3h1"/><circle cx="18" cy="20" r="2"/></svg>',
    U: '<svg viewBox="0 0 24 24"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 8h4M19 6v4"/><path d="M17 16h4"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c-5 1-9-3-9-9z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><path d="M12 4v2M12 18v2M4 12h2M18 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4"/></svg>'
  };
  return icons[key] || icons.D;
}

function renderContent() {
  const content = document.querySelector('#content');
  if (state.view === 'submit' && can(PERMISSIONS.SUBMISSIONS_CREATE)) {
    content.innerHTML = renderAssessmentForm(state.editingSubmissionRecord);
    bindAssessmentForm();
    return;
  }

  if (state.view === 'doctor-dashboard' && state.user.role === ROLES.DOCTOR) {
    content.innerHTML = renderDoctorDashboard();
    bindDoctorDashboard();
    return;
  }

  if (state.view === 'doctor-reports' && state.user.role === ROLES.DOCTOR) {
    content.innerHTML = renderDoctorReports();
    bindDoctorReports();
    return;
  }

  if (state.view === 'hr-dashboard' && [ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    content.innerHTML = renderHrDashboard();
    bindHrDashboard();
    return;
  }

  if (state.view === 'user-management' && [ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    content.innerHTML = renderUserManagement();
    bindUserManagement();
    return;
  }

  if (state.view === 'medical-offices' && [ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    content.innerHTML = renderMedicalOfficeManagement();
    bindMedicalOfficeManagement();
    return;
  }

  if (state.view === 'doctor-management' && [ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    content.innerHTML = renderDoctorManagement();
    bindDoctorManagement();
    return;
  }

  if (state.view === 'report-management' && [ROLES.REVIEWER, ROLES.ADMIN].includes(state.user.role)) {
    content.innerHTML = renderReportManagement();
    bindReportManagement();
    return;
  }

  if (state.view === 'mine' && can(PERMISSIONS.SUBMISSIONS_LIST)) {
    content.innerHTML = renderSubmissionBrowser('Your submitted assessments');
    bindSubmissionBrowser();
    return;
  }

  if (state.view === 'admin' && can(PERMISSIONS.USERS_MANAGE)) {
    content.innerHTML = renderAdmin();
    bindAdmin();
    return;
  }

  if (state.view === 'setup' && can(PERMISSIONS.PATIENT_PROFILES_LIST)) {
    content.innerHTML = renderPatientManagement();
    bindPatientManagement();
    return;
  }

  if (state.view === 'cases' && can(PERMISSIONS.MEDICAL_CASES_CREATE)) {
    content.innerHTML = renderCaseManagement();
    bindCaseManagement();
    return;
  }

  if (state.view === 'my-medicals' && can(PERMISSIONS.MEDICAL_CASES_LIST)) {
    content.innerHTML = state.selectedCase ? renderPatientMedicalCaseForm() : renderMyMedicals();
    bindMyMedicals();
    return;
  }

  if (state.view === 'profile') {
    content.innerHTML = state.user.role === ROLES.PATIENT ? renderPatientProfile() : renderAccountProfile();
    if (state.user.role === ROLES.PATIENT) bindPatientProfile();
    else bindAccountProfile();
    return;
  }

  if (state.view === 'archive' && can(PERMISSIONS.SUBMISSIONS_REVIEW)) {
    content.innerHTML = renderArchiveBrowser();
    bindArchiveBrowser();
    return;
  }

  if (state.view === 'review' && can(PERMISSIONS.SUBMISSIONS_REVIEW)) {
    content.innerHTML = renderHrReviewQueue();
    bindHrReviewQueue();
    return;
  }

  content.innerHTML = renderPatientProfile();
  bindPatientProfile();
}

function bindPatientProfile() {
  const form = document.querySelector('#patientProfileForm');
  if (!form) return;
  bindPhoneFormatting(form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const response = await api(`/api/candidates/${encodeURIComponent(form.dataset.candidateId)}`, {
      method: 'PATCH',
      body: {
        email: data.get('email'),
        contactNumber: data.get('contactNumber'),
        address: data.get('address'),
        primaryPhysician: data.get('primaryPhysician'),
        emergencyContactName: data.get('emergencyContactName'),
        emergencyContactNumber: data.get('emergencyContactNumber')
      }
    });
    state.candidates = state.candidates.map((item) => item.id === response.candidate.id ? response.candidate : item);
    document.querySelector('#patientProfileMessage').textContent = 'Profile saved.';
  });
}

function renderPatientProfile() {
  const profile = state.candidates.find((candidate) => candidate.email?.toLowerCase() === state.user.email) || null;
  if (!profile) {
    loadPatientProfile();
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Profile</h2>
            <div class="muted">Loading your profile.</div>
          </div>
        </div>
      </section>
    `;
  }
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Profile</h2>
          <div class="muted">Update your contact details for medical onboarding.</div>
        </div>
      </div>
      <div class="panel-body">
        <form id="patientProfileForm" class="form-stack" data-candidate-id="${escapeHtml(profile.id)}">
          <div class="grid-3">
            ${readonlyField('Full name', profile.fullName)}
            ${readonlyField('Employee/applicant ID', profile.employeeId)}
            ${readonlyField('National ID/TRN', profile.nationalId)}
            ${readonlyField('Date of birth', profile.dateOfBirth)}
            ${readonlyField('Position', profile.position)}
            ${field('email', 'Email address', 'email', false, profile.email || '')}
            ${field('contactNumber', 'Phone number', 'text', false, profile.contactNumber || '')}
            ${field('address', 'Address', 'text', false, profile.address || '')}
            ${field('primaryPhysician', 'Primary physician / doctor', 'text', false, profile.primaryPhysician || '')}
            ${field('emergencyContactName', 'Emergency contact name', 'text', false, profile.emergencyContactName || '')}
            ${field('emergencyContactNumber', 'Emergency contact number', 'text', false, profile.emergencyContactNumber || '')}
          </div>
          <div id="patientProfileMessage" class="notice is-quiet" role="status"></div>
          <button class="primary-btn" type="submit">Save profile</button>
        </form>
      </div>
    </section>
  `;
}

async function loadPatientProfile() {
  try {
    const response = await api('/api/candidates');
    state.candidates = response.candidates || [];
    if (state.view === 'profile' || state.view === 'patient') renderShell();
  } catch {}
}

function bindAccountProfile() {
  const form = document.querySelector('#accountProfileForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const response = await api('/api/me', {
      method: 'PATCH',
      body: {
        displayName: data.get('displayName'),
          medicalProfile: {
            officeUserType: data.get('officeUserType'),
            facilityName: data.get('facilityName'),
            facilityAddress: data.get('facilityAddress'),
            clinicianName: data.get('clinicianName'),
            registrationNumber: data.get('registrationNumber'),
            defaultMedicalFee: data.get('defaultMedicalFee'),
            signatureDataUrl: state.user.medicalProfile?.signatureDataUrl || ''
          }
      }
    });
    state.user = response.user;
    renderShell();
  });
}

function renderAccountProfile() {
  const profile = state.user.medicalProfile || {};
  const isDoctor = state.user.role === ROLES.DOCTOR;
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Profile</h2>
          <div class="muted">${escapeHtml(isDoctor ? 'Manage your medical office details.' : 'Manage your account details.')}</div>
        </div>
      </div>
      <div class="panel-body">
        <form id="accountProfileForm" class="form-stack">
          <div class="form-section">
            <h3>Account</h3>
            <div class="grid-2">
              ${field('displayName', 'Name', 'text', true, state.user.displayName || '')}
              ${readonlyField('Email address', state.user.email)}
              ${readonlyField('Role', roleLabel(state.user.role))}
            </div>
          </div>
          ${isDoctor ? `
            <div class="form-section">
              <h3>Medical office</h3>
              <div class="grid-2">
                <div class="field">
                  <label for="officeUserType">Office user type</label>
                  <select id="officeUserType" name="officeUserType">
                    <option value="doctor" ${medicalOfficeUserType(state.user) === 'doctor' ? 'selected' : ''}>Doctor</option>
                    <option value="clinician" ${medicalOfficeUserType(state.user) === 'clinician' ? 'selected' : ''}>Clinician / support</option>
                  </select>
                </div>
                ${field('facilityName', 'Medical office name', 'text', false, profile.facilityName || '')}
                ${field('clinicianName', 'Clinician name', 'text', false, profile.clinicianName || state.user.displayName || '')}
                ${field('registrationNumber', 'Registration number', 'text', false, profile.registrationNumber || '')}
                ${field('defaultMedicalFee', 'Doctor rate', 'number', false, profile.defaultMedicalFee || '')}
                ${field('facilityAddress', 'Office address', 'text', false, profile.facilityAddress || '')}
              </div>
            </div>
          ` : ''}
          <div id="accountProfileMessage" class="notice is-quiet" role="status"></div>
          <button class="primary-btn" type="submit">Save profile</button>
        </form>
      </div>
    </section>
  `;
}

function renderAssessmentForm(existing = null) {
  const today = new Date().toISOString().slice(0, 10);
  const isEditing = Boolean(existing);
  return `
    <form id="assessmentForm" class="assessment-form">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>${isEditing ? 'Update requested assessment' : 'Process medical case'}</h2>
            <div class="muted">${escapeHtml(isEditing ? 'Review requested an update. Edit the assessment and resubmit it for review.' : state.settings.clinicianIntro)}</div>
          </div>
          <span class="status ${isEditing ? 'needs_follow_up' : 'pending'}">${isEditing ? 'Edit requested' : 'Draft'}</span>
        </div>
        <div class="panel-body form-stack">
          <div class="tab-list" role="tablist" aria-label="Medical case sections">
            ${['Patient information', 'Doctor assessment', 'Tests', 'Determination', 'Attachments & signature'].map((label, index) => `
              <button class="tab-button ${index === 0 ? 'is-active' : ''}" type="button" data-tab="${index}">${escapeHtml(label)}</button>
            `).join('')}
          </div>

          <section class="tab-panel is-active" data-tab-panel="0">
            <h3>Patient-entered information</h3>
            <div id="doctorPatientContext" class="doctor-patient-context"></div>
            <input name="candidate.caseId" type="hidden" value="${escapeHtml(state.selectedDoctorCaseId || '')}">
            <input name="candidate.candidateId" type="hidden">
            <input name="candidate.patientId" type="hidden">
            <input name="candidate.fullName" type="hidden">
            <input name="candidate.employeeId" type="hidden">
            <input name="candidate.nationalId" type="hidden">
            <input name="candidate.dateOfBirth" type="hidden">
            <input name="candidate.email" type="hidden">
            <input name="candidate.contactNumber" type="hidden">
            <input name="candidate.position" type="hidden">
            <input name="candidate.medicationInformation" type="hidden">
            <h3>Family history</h3>
            <div class="doctor-hidden-fields">
            <div class="checkbox-grid">
              ${checkbox('familyHistory.hypertension', 'Family history of high blood pressure / hypertension')}
              ${checkbox('familyHistory.diabetes', 'Family history of diabetes')}
              ${checkbox('familyHistory.heartDisease', 'Family history of heart disease')}
              ${checkbox('familyHistory.asthma', 'Family history of asthma or chronic breathing illness')}
              ${checkbox('familyHistory.cancer', 'Family history of cancer')}
              ${checkbox('familyHistory.stroke', 'Family history of stroke')}
              ${checkbox('familyHistory.kidneyDisease', 'Family history of kidney disease')}
              ${checkbox('familyHistory.mentalHealth', 'Family history of mental health condition')}
            </div>
            ${textarea('familyHistory.notes', 'Family history notes')}
            ${textarea('medicalHistory.notes', 'Patient medical history notes')}
            </div>
          </section>

          <section class="tab-panel" data-tab-panel="1">
            <h3>Doctor assessment</h3>
            <div class="doctor-entry-section">
            <div class="grid-2">
              ${field('assessment.facilityName', 'Medical facility', 'text', true)}
              ${field('assessment.assessmentDate', 'Assessment date', 'date', true, today)}
              ${field('assessment.facilityAddress', 'Facility address')}
              ${field('assessment.clinicianName', 'Clinician name', 'text', true)}
              ${field('assessment.clinicianRegistrationNumber', 'Registration number')}
              ${field('assessment.telephoneNumber', 'Telephone No.')}
              ${field('assessment.faxNumber', 'Fax No.')}
              ${field('assessment.emailAddress', 'E-mail address', 'email')}
            </div>
            </div>
            ${renderPhysicianExamSections()}
          </section>

          <section class="tab-panel" data-tab-panel="2">
            <h3>Tests</h3>
            <div class="doctor-entry-section">
              ${textarea('labResults.additionalTests', 'Laboratory (Please list below any additional laboratory or diagnostic tests required to complete your assessment)')}
            </div>
          </section>

          <section class="tab-panel" data-tab-panel="3">
            <h3>Determination</h3>
            <div class="doctor-entry-section">
            ${textarea('determination.conclusions', 'Conclusions (Please state your opinion on the physical and mental health of the candidate and fitness for duty)')}
            <div class="grid-2">
              <div class="field">
                <label for="determination-status">Please check the applicable box</label>
                <select id="determination-status" name="determination.status" required>
                  <option value="">Select</option>
                  <option value="fit">Cleared Fit For Employment on Medical Grounds</option>
                  <option value="not_fit">Not Fit For Employment on Medical Grounds</option>
                  <option value="fit_with_restrictions">Fit with restrictions</option>
                  <option value="temporarily_deferred">Temporarily deferred</option>
                </select>
              </div>
              ${field('determination.followUpDate', 'Follow-up date', 'date')}
              ${textarea('determination.restrictions', 'Restrictions')}
              ${textarea('determination.recommendation', 'Recommendation')}
            </div>
            </div>
          </section>

          <section class="tab-panel" data-tab-panel="4">
            <h3>Attachments and signature</h3>
            <div class="doctor-entry-section">
            <div class="field">
              <label for="caseAttachmentUpload">Upload case image attachment</label>
              <input id="caseAttachmentUpload" name="caseAttachmentUpload" type="file" accept="image/png,image/jpeg,image/webp">
              <div class="field-help">Allowed image types: PNG, JPG, or WebP. Files are uploaded to secured case storage.</div>
              <div id="attachmentList" class="attachment-list"></div>
            </div>
            <div class="grid-2">
              ${field('attestation.signedBy', 'Signed by', 'text', true)}
              ${field('attestation.signatureDate', 'Signature date', 'date', true, today)}
              <div class="field">
                <label for="signatureUpload">Upload signature image</label>
                <input id="signatureUpload" name="signatureUpload" type="file" accept="image/png,image/jpeg,image/webp">
                <div class="field-help">You may upload a PNG, JPG, or WebP signature image.</div>
                <input name="attestation.signatureDataUrl" type="hidden" value="${escapeHtml(state.user.medicalProfile?.signatureDataUrl || '')}">
              </div>
            </div>
            <div class="field">
              <label>Draw or type signature</label>
              <canvas id="signaturePad" class="signature-pad" width="640" height="180"></canvas>
              <div class="toolbar">
                <button class="secondary-btn" type="button" data-action="clear-signature">Clear signature</button>
                <button class="secondary-btn" type="button" data-action="use-typed-signature">Use typed name</button>
              </div>
            </div>
            </div>
            <label class="check">
              <input name="attestation.consentConfirmed" type="checkbox" required>
              <span>I confirm candidate consent was obtained and this submission is accurate.</span>
            </label>
            ${renderCustomFields('doctor', existing?.customFields || {})}
          </section>

          <div id="formError" class="error" role="alert"></div>
          ${!isDoctorOfficeUser(state.user) ? '<div class="notice is-quiet">Clinician/support users can save draft progress. Final submission must be completed by a doctor.</div>' : ''}
          <div class="patient-form-footer doctor-form-footer">
            <div class="save-progress">
              <button class="secondary-btn" type="reset">${isEditing ? 'Revert changes' : 'Clear'}</button>
              <button class="secondary-btn" type="button" data-action="save-draft">Save draft</button>
              <button class="danger-btn secondary-btn" type="button" data-action="cancel-case">Cancel case</button>
            </div>
            <div class="toolbar doctor-form-nav" aria-label="Doctor form navigation">
              <button class="secondary-btn" type="button" data-action="doctor-prev-tab" hidden>Previous</button>
              <button class="primary-btn" type="button" data-action="doctor-next-tab">Next</button>
              <button class="primary-btn" id="doctorFinalSubmit" type="submit" hidden ${isDoctorOfficeUser(state.user) ? '' : 'disabled'}>${isEditing ? 'Submit updated assessment' : 'Final submit'}</button>
            </div>
          </div>
        </div>
      </div>
    </form>
  `;
}

function renderDoctorDashboard() {
  const stats = doctorDashboardStats();
  return `
    <div class="doctor-dashboard">
      <section class="doctor-stat-grid">
        ${doctorStatCard('New cases', stats.newCases, 'new-cases', stats.newCases > 0)}
        ${doctorStatCard('Submitted for HR Review', stats.submittedForHrReview, 'submitted-for-hr-review', stats.submittedForHrReview > 0)}
        ${doctorStatCard('Processed this month', stats.processedThisMonth, 'doctor-reports', stats.processedThisMonth > 0)}
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Inbox medicals</h2>
            <div class="muted">${stats.inbox.length} active ${stats.inbox.length === 1 ? 'case' : 'cases'}</div>
          </div>
          <button class="secondary-btn" data-action="refresh-doctor-dashboard">Refresh</button>
        </div>
        <div class="panel-body">
          ${renderDoctorCaseRows(stats.inbox, true)}
        </div>
      </section>
      <div id="doctorCaseModal"></div>
    </div>
    ${renderDetailModal()}
  `;
}

function renderPhysicianExamSections() {
  return physicianExamSections.map((section) => `
    <div class="doctor-entry-section physician-section">
      <div>
        <h3>${escapeHtml(section.title)}</h3>
        ${section.help ? `<div class="field-help">${escapeHtml(section.help)}</div>` : ''}
      </div>
      <div class="grid-2">
        ${section.fields.map(([key, label, type]) => {
          const name = `physicalExam.${key}`;
          return type === 'textarea' ? textarea(name, label) : field(name, label);
        }).join('')}
      </div>
    </div>
  `).join('');
}

function currentFormTemplate() {
  const template = state.settings.formTemplate && Array.isArray(state.settings.formTemplate.fields)
    ? state.settings.formTemplate
    : defaultFormTemplate();
  return {
    ...template,
    processSteps: mergeProcessSteps(template.processSteps),
    fields: mergeTemplateFields(template.fields)
  };
}

function mergeProcessSteps(steps = []) {
  const defaults = defaultProcessSteps();
  const byId = new Map(defaults.map((step) => [step.id, step]));
  const ordered = [];
  (Array.isArray(steps) ? steps : []).forEach((step) => {
    if (!step?.id) return;
    const merged = { ...(byId.get(step.id) || {}), ...step };
    byId.set(step.id, merged);
    ordered.push(merged);
  });
  defaults.forEach((step) => {
    if (!ordered.some((item) => item.id === step.id)) ordered.push(byId.get(step.id));
  });
  return ordered;
}

function mergeTemplateFields(fields = []) {
  const defaults = defaultFormTemplate().fields;
  const byId = new Map(defaults.map((field) => [field.id, field]));
  const ordered = [];
  fields.forEach((field) => {
    if (!field?.id) return;
    const merged = { ...(byId.get(field.id) || {}), ...field };
    byId.set(field.id, merged);
    ordered.push(merged);
  });
  defaults.forEach((field) => {
    if (!ordered.some((item) => item.id === field.id)) ordered.push(byId.get(field.id));
  });
  return ordered;
}

function formFieldsFor(surface, role = state.user?.role) {
  const activeSteps = new Set(currentFormTemplate().processSteps.filter((step) => step.active !== false).map((step) => step.id));
  return currentFormTemplate().fields
    .filter((field) => field.active !== false && field.surface === surface)
    .filter((field) => !field.stepId || activeSteps.has(field.stepId))
    .filter((field) => !role || (field.visibleRoles || []).includes(role) || role === ROLES.ADMIN);
}

function fieldConfigFor(surface, name) {
  return formFieldsFor(surface).find((field) => field.name === name);
}

function applyFormTemplate(form, surface) {
  if (!form) return;
  const role = state.user?.role;
  currentFormTemplate().fields
    .filter((field) => field.surface === surface)
    .forEach((field) => {
      const visible = field.active !== false && ((field.visibleRoles || []).includes(role) || role === ROLES.ADMIN);
      if (visible) return;
      form.querySelectorAll(`[name="${cssEscape(field.name)}"]`).forEach((control) => {
        const wrapper = control.closest('.field, .check, .form-section, .medical-office-field') || control;
        wrapper.hidden = true;
        control.disabled = true;
        control.required = false;
      });
    });
  formFieldsFor(surface).forEach((field) => {
    const controls = Array.from(form.querySelectorAll(`[name="${cssEscape(field.name)}"]`));
    controls.forEach((control) => {
      const wrapper = control.closest('.field, .check, .form-section, .medical-office-field') || control;
      const label = wrapper.querySelector('label, span');
      if (label && field.label) label.textContent = field.label;
      const editable = (field.editableRoles || []).includes(state.user?.role) || state.user?.role === ROLES.ADMIN;
      const required = (field.requiredRoles || []).includes(state.user?.role);
      if (!editable) {
        if (['SELECT', 'INPUT', 'TEXTAREA'].includes(control.tagName)) control.disabled = true;
      }
      if (required && ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) control.required = true;
    });
  });
}

function renderCustomFields(surface, values = {}) {
  const fields = formFieldsFor(surface).filter((field) => !field.builtIn);
  if (!fields.length) return '';
  return `
    <div class="form-section custom-form-section">
      <h3>Additional information</h3>
      <div class="grid-2">
        ${fields.map((field) => renderDynamicField(field, values[field.id] || '')).join('')}
      </div>
    </div>
  `;
}

function renderDynamicField(config, value = '') {
  const name = `customFields.${config.id}`;
  const label = config.label || 'Custom field';
  if (config.type === 'information') {
    return `
      <div class="notice is-quiet dynamic-information-field">
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml((config.options || []).join('\n') || 'Information block')}</p>
      </div>
    `;
  }
  if (config.type === 'textarea') return textarea(name, label, value);
  if (config.type === 'select' || config.type === 'yes_no') {
    const options = config.type === 'yes_no' ? ['Yes', 'No'] : (config.options || []);
    return `
      <div class="field">
        <label for="${escapeHtml(name.replace(/\./g, '-'))}">${escapeHtml(label)}</label>
        <select id="${escapeHtml(name.replace(/\./g, '-'))}" name="${escapeHtml(name)}">
          <option value="">Select</option>
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>
      </div>
    `;
  }
  if (config.type === 'radio') {
    const options = config.options || [];
    return `
      <div class="field">
        <span class="label">${escapeHtml(label)}</span>
        <div class="radio-grid">
          ${options.map((option) => `
            <label class="check"><input name="${escapeHtml(name)}" value="${escapeHtml(option)}" type="radio" ${value === option ? 'checked' : ''}> <span>${escapeHtml(option)}</span></label>
          `).join('')}
        </div>
      </div>
    `;
  }
  if (config.type === 'checkbox') {
    return `<label class="check"><input name="${escapeHtml(name)}" type="checkbox" ${value === true || value === 'on' ? 'checked' : ''}> <span>${escapeHtml(label)}</span></label>`;
  }
  return field(name, label, config.type === 'phone' ? 'tel' : config.type, false, value);
}

function collectCustomFields(form) {
  const data = new FormData(form);
  const values = {};
  currentFormTemplate().fields.filter((field) => !field.builtIn).forEach((field) => {
    const key = `customFields.${field.id}`;
    if (field.type === 'information') return;
    values[field.id] = field.type === 'checkbox' ? data.has(key) : (data.get(key) || '');
  });
  return values;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

function doctorStatCard(label, value, target, clickable = false) {
  return `
    <button class="doctor-stat-card ${clickable ? 'is-clickable' : ''}" type="button" data-stat-target="${escapeHtml(target)}" ${clickable ? '' : 'disabled'}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </button>
  `;
}

function resetRoleWorkspaceState() {
  state.cases = [];
  state.submissions = [];
  state.doctorWorkspaceLoaded = false;
  state.doctorReportRows = [];
  state.doctorReportPagination = { total: 0, limit: 10, offset: 0, hasMore: false };
  state.doctorReportSummary = {
    processed: 0,
    processedThisMonth: 0,
    pendingHrReview: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    paidCount: 0,
    followUpCount: 0,
    averageTurnaroundHours: 0
  };
  state.doctorReportSearch = '';
  state.doctorReportStatus = '';
  state.doctorReportPaymentStatus = '';
  state.doctorReportPage = 1;
  state.doctorReportLoading = false;
  state.doctorReportLoaded = false;
  state.doctorReportError = '';
  state.selectedDoctorReportCaseId = '';
  state.selectedDoctorReportCase = null;
  state.selectedDoctorReportSubmission = null;
}

function bindDoctorDashboard() {
  if (!state.doctorWorkspaceLoaded) loadDoctorWorkspace();
  document.querySelector('[data-action="refresh-doctor-dashboard"]')?.addEventListener('click', loadDoctorWorkspace);
  document.querySelectorAll('.doctor-stat-card[data-stat-target]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.statTarget === 'doctor-reports') {
        state.view = 'doctor-reports';
        renderShell();
        return;
      }
      openDoctorCaseModal(button.dataset.statTarget);
    });
  });
  bindDoctorCaseRows();
}

async function loadDoctorWorkspace() {
  const [casesResponse, submissionsResponse] = await Promise.all([
    api('/api/cases').catch(() => ({ cases: [] })),
    api('/api/submissions').catch(() => ({ submissions: [] }))
  ]);
  state.cases = casesResponse.cases || [];
  state.submissions = submissionsResponse.submissions || [];
  state.doctorWorkspaceLoaded = true;
  const content = document.querySelector('#content');
  if (content && ['doctor-dashboard', 'doctor-reports'].includes(state.view)) renderContent();
}

function doctorDashboardStats() {
  const cases = state.cases || [];
  const submissions = state.submissions || [];
  const inbox = cases.filter((item) => item.status === 'sent_to_doctor');
  const submittedForHrReview = cases.filter((item) => ['doctor_submitted', 'review_pending'].includes(item.status)).length;
  const currentMonth = monthKeyLocal(new Date().toISOString());
  const processedThisMonth = submissions.filter((item) => monthKeyLocal(item.submittedAt) === currentMonth).length;
  const newCases = cases.filter((item) => item.status === 'sent_to_doctor').length;
  return { cases, submissions, inbox, newCases, submittedForHrReview, processedThisMonth };
}

function openDoctorCaseModal(target) {
  const stats = doctorDashboardStats();
  const cases = target === 'submitted-for-hr-review'
    ? stats.cases.filter((item) => ['doctor_submitted', 'review_pending'].includes(item.status))
    : stats.cases.filter((item) => item.status === 'sent_to_doctor');
  const modal = document.querySelector('#doctorCaseModal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-backdrop" data-action="close-doctor-modal">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="Cases">
        <div class="panel-header">
          <h2>${target === 'submitted-for-hr-review' ? 'Submitted for HR Review' : 'New cases'}</h2>
          <button class="secondary-btn" type="button" data-action="close-doctor-modal">Close</button>
        </div>
        <div class="panel-body">${renderDoctorCaseRows(cases, false)}</div>
      </section>
    </div>
  `;
  modal.querySelectorAll('[data-action="close-doctor-modal"]').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target === item) modal.innerHTML = '';
    });
  });
  bindDoctorCaseRows();
}

function renderDoctorCaseRows(cases, emptyAsInbox = false) {
  if (!cases.length) return `<div class="empty">${emptyAsInbox ? 'No inbox medicals.' : 'No medicals found.'}</div>`;
  return `
    <div class="doctor-case-list">
      <div class="doctor-case-row doctor-case-head">
        <strong>Candidate</strong>
        <strong>Status</strong>
        <strong>Assigned</strong>
        <strong>Action</strong>
      </div>
      ${cases.map((medicalCase) => `
        <div class="doctor-case-row">
          <div>
            <strong>${escapeHtml(medicalCase.patientName || 'Patient')}</strong>
            <span>${escapeHtml(medicalCase.position || 'Position not recorded')}</span>
          </div>
          <span class="status ${escapeHtml(medicalCase.status)}">${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</span>
          <span>${escapeHtml(formatDateTime(medicalCase.assignedAt || medicalCase.createdAt))}</span>
          <button class="primary-btn" type="button" data-action="open-doctor-case" data-case-id="${escapeHtml(medicalCase.id)}">Open</button>
        </div>
      `).join('')}
    </div>
  `;
}

function bindDoctorCaseRows() {
  document.querySelectorAll('[data-action="open-doctor-case"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDoctorCaseId = button.dataset.caseId;
      state.editingSubmissionRecord = null;
      state.view = 'submit';
      renderShell();
    });
  });
}

function renderDoctorReports() {
  if (state.selectedDoctorReportCaseId) return renderDoctorReportDetail();
  const rows = state.doctorReportRows || [];
  const pagination = state.doctorReportPagination || {};
  const summary = state.doctorReportSummary || {};
  const pageCount = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 10)));
  return `
    <div class="doctor-report-page">
      <section class="doctor-report-summary" aria-label="Doctor report summary">
        ${doctorReportMetric('Processed this month', summary.processedThisMonth || 0)}
        ${doctorReportMetric('Pending HR review', summary.pendingHrReview || 0)}
        ${doctorReportMetric('Unpaid', `${summary.unpaidCount || 0} · ${formatCurrency(summary.unpaidAmount || 0)}`)}
      </section>

      <section class="panel doctor-report-panel">
        <div class="panel-header">
          <div>
            <h2>Processed medicals</h2>
            <div class="muted">${escapeHtml(String(pagination.total || 0))} medicals submitted by you, newest first.</div>
          </div>
          <button class="secondary-btn compact-primary" type="button" data-action="refresh-doctor-reports">Refresh</button>
        </div>
        <div class="panel-body form-stack">
          ${state.doctorReportError ? `<div class="notice is-error" role="alert">${escapeHtml(state.doctorReportError)}</div>` : ''}
          <div class="doctor-report-toolbar">
            <div class="field doctor-report-search">
              <label class="sr-only" for="doctorReportSearch">Search processed medicals</label>
              <input id="doctorReportSearch" type="search" value="${escapeHtml(state.doctorReportSearch)}" placeholder="Search patient, case ID, applicant ID or position">
            </div>
            <div class="field">
              <label class="sr-only" for="doctorReportStatus">Current status</label>
              <select id="doctorReportStatus">
                <option value="">All statuses</option>
                ${['doctor_submitted', 'review_pending', 'reviewed', 'archived', 'canceled_by_doctor', 'withdrawn'].map((status) => `
                  <option value="${status}" ${state.doctorReportStatus === status ? 'selected' : ''}>${escapeHtml(caseStatusLabels[status] || status)}</option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label class="sr-only" for="doctorReportPayment">Payment status</label>
              <select id="doctorReportPayment">
                <option value="">All payments</option>
                ${['unpaid', 'paid', 'not_payable'].map((status) => `
                  <option value="${status}" ${state.doctorReportPaymentStatus === status ? 'selected' : ''}>${escapeHtml(paymentStatusLabel(status))}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="doctor-case-list doctor-report-table" aria-live="polite">
            ${state.doctorReportLoading ? '<div class="empty">Loading processed medicals...</div>' : renderDoctorReportRows(rows)}
          </div>

          <div class="pagination-bar">
            <span>Page ${state.doctorReportPage} of ${pageCount}</span>
            <button class="secondary-btn compact-primary" type="button" data-action="doctor-report-prev" ${state.doctorReportPage <= 1 ? 'disabled' : ''}>Previous</button>
            <button class="secondary-btn compact-primary" type="button" data-action="doctor-report-next" ${pagination.hasMore ? '' : 'disabled'}>Next</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function doctorReportMetric(label, value) {
  return `
    <div class="doctor-report-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderDoctorReportRows(rows) {
  if (!rows.length) {
    return '<div class="empty">No processed medicals match these filters.</div>';
  }
  return `
    <div class="doctor-case-row doctor-case-head doctor-report-row">
      <strong>Patient</strong>
      <strong>Submitted</strong>
      <strong>Current status</strong>
      <strong>Payment</strong>
      <strong>Action</strong>
    </div>
    ${rows.map((row) => `
      <div class="doctor-case-row doctor-report-row">
        <div class="doctor-report-patient">
          <strong>${escapeHtml(row.patientName || 'Patient')}</strong>
          <span>${escapeHtml(labelStatus(row.determinationStatus) || 'Determination not recorded')}</span>
        </div>
        <span>${escapeHtml(formatDateTime(row.submittedAt))}</span>
        <span class="status ${escapeHtml(row.status)} doctor-report-status-text ${row.reviewStatus === 'needs_follow_up' ? 'needs-follow-up' : ''}">${escapeHtml(`${caseStatusLabels[row.status] || row.status}${row.reviewStatus === 'needs_follow_up' ? ' | Follow-up' : ''}`)}</span>
        <span>${escapeHtml([paymentStatusLabel(row.paymentStatus), row.payableAmount ? formatCurrency(row.payableAmount) : ''].filter(Boolean).join(' | '))}</span>
        <button class="text-btn doctor-report-open" type="button" data-open-doctor-report-case="${escapeHtml(row.id)}" data-submission-id="${escapeHtml(row.submissionId)}">Open</button>
      </div>
    `).join('')}
  `;
}

function renderDoctorReportDetail() {
  const medicalCase = state.selectedDoctorReportCase;
  const submission = state.selectedDoctorReportSubmission;
  if (!medicalCase) {
    return `
      <section class="panel">
        <div class="panel-header">
          <button class="text-btn patient-back-btn" type="button" data-action="back-to-doctor-reports">Back to reports</button>
        </div>
        <div class="panel-body"><div class="empty">Loading medical report...</div></div>
      </section>
    `;
  }
  const patientData = medicalCase.patientCaseData || submission?.patientCaseData || {};
  return `
    <div class="admin-grid doctor-report-detail">
      <section class="panel">
        <div class="panel-header patient-detail-header">
          <div>
            <button class="text-btn patient-back-btn" type="button" data-action="back-to-doctor-reports">Back to reports</button>
            <h2>${escapeHtml(medicalCase.patientName || submission?.candidate?.fullName || 'Medical report')}</h2>
            <div class="muted">${escapeHtml(medicalCase.id)} · Submitted ${escapeHtml(formatDateTime(submission?.submittedAt || medicalCase.submittedAt))}</div>
          </div>
          <div class="header-actions">
            ${medicalCase.submissionId ? `<a class="secondary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/download">Download PDF</a>` : ''}
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="case-workspace-strip doctor-report-detail-strip">
            ${caseWorkspacePill('Current status', caseStatusLabels[medicalCase.status] || medicalCase.status)}
            ${caseWorkspacePill('Determination', labelStatus(submission?.determination?.status) || 'Not recorded')}
            ${caseWorkspacePill('Payment', `${paymentStatusLabel(doctorPaymentStatus(medicalCase))}${medicalCase.payableAmount ? ` · ${formatCurrency(medicalCase.payableAmount)}` : ''}`)}
            ${caseWorkspacePill('HR review', labelStatus(submission?.review?.status || 'pending'))}
          </div>
          <div id="doctorReportTabs" class="case-workspace-tabs">
            <div class="tab-list case-tab-list" role="tablist" aria-label="Processed medical details">
              ${['Overview', 'Patient form', 'Doctor assessment', 'Documents'].map((label, index) => `
                <button class="tab-button ${index === 0 ? 'is-active' : ''}" type="button" data-tab="${index}">${escapeHtml(label)}</button>
              `).join('')}
            </div>
            <section class="tab-panel is-active" data-tab-panel="0">
              ${recordSection('Case', [
                ['Case ID', medicalCase.id],
                ['Patient', medicalCase.patientName],
                ['Applicant ID', medicalCase.employeeId],
                ['Position', medicalCase.position],
                ['Assigned', formatDateTime(medicalCase.assignedAt)],
                ['Submitted', formatDateTime(submission?.submittedAt || medicalCase.submittedAt)],
                ['Current stage', caseStageLabel(medicalCase)]
              ])}
              ${recordSection('Review and payment', [
                ['HR review status', labelStatus(submission?.review?.status || 'pending')],
                ['HR review notes', submission?.review?.notes],
                ['Payment status', paymentStatusLabel(doctorPaymentStatus(medicalCase))],
                ['Payable amount', medicalCase.payableAmount ? formatCurrency(medicalCase.payableAmount) : 'Not recorded']
              ])}
            </section>
            <section class="tab-panel" data-tab-panel="1">
              ${recordSection('Personal and consent', patientPersonalRows(patientData, medicalCase))}
              ${renderPatientFamilyHistory(patientData)}
              ${renderPatientMedicalHistory(patientData, medicalCase)}
            </section>
            <section class="tab-panel" data-tab-panel="2">
              ${submission ? renderSubmissionAssessment(submission) : '<div class="empty">The submitted doctor assessment could not be loaded.</div>'}
            </section>
            <section class="tab-panel" data-tab-panel="3">
              ${renderCaseDocuments(medicalCase, submission)}
            </section>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderHrDashboard() {
  const openCases = state.cases.filter((item) => !['doctor_submitted', 'archived', 'withdrawn', 'canceled_by_doctor'].includes(item.status)).length;
  const awaitingPatient = state.cases.filter((item) => item.status === 'sent_to_patient').length;
  const withDoctor = state.cases.filter((item) => ['sent_to_doctor', 'review_pending'].includes(item.status)).length;
  const hrReviewCases = state.cases.filter((item) => item.status === 'doctor_submitted');
  const unpaidActiveCases = state.cases.filter((item) => doctorPaymentStatus(item) === 'unpaid' && ['reviewed', 'review_pending'].includes(item.status));
  const actionCases = [...hrReviewCases.slice(0, 3), ...unpaidActiveCases.slice(0, 3)].slice(0, 5);
  const hasActionItems = hrReviewCases.length > 0 || unpaidActiveCases.length > 0;
  return `
    <div class="dashboard-console">
      <section class="dashboard-titlebar hr-dashboard-titlebar">
        <div>
          <h2>Dashboard</h2>
          <span>${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
        </div>
        <button class="primary-btn" type="button" data-view="cases">New medical</button>
      </section>
      <section class="hr-action-panel">
        <div class="hr-action-panel-header">
          <div>
            <h3>Needs attention</h3>
          </div>
          ${hasActionItems ? '<button class="secondary-btn compact-primary" type="button" data-view="review">Open review queue</button>' : ''}
        </div>
        <div class="hr-action-grid">
          ${hrDashboardActionCard({
            title: 'Ready for HR review',
            value: hrReviewCases.length,
            description: 'Submitted by medical office',
            view: 'review',
            tone: 'review'
          })}
          ${hrDashboardActionCard({
            title: 'Active unpaid',
            value: unpaidActiveCases.length,
            description: 'Reviewed or in progress, not paid',
            view: 'report-management',
            tone: 'billing'
          })}
        </div>
        ${hasActionItems ? `
          <div class="hr-action-list">
            ${actionCases.map((item) => `
            <button class="hr-action-row" type="button" data-dashboard-case-id="${escapeHtml(item.id)}">
              <span>
                <strong>${escapeHtml(item.patientName || 'Patient')}</strong>
                <small>${escapeHtml([item.employeeId, caseStatusLabels[item.status] || item.status].filter(Boolean).join(' | '))}</small>
              </span>
              <em>${escapeHtml(item.status === 'doctor_submitted' ? 'Review' : paymentStatusLabel(doctorPaymentStatus(item)))}</em>
            </button>
          `).join('')}
            ${(hrReviewCases.length + unpaidActiveCases.length) > actionCases.length ? `
              <div class="hr-action-footer">
                <span>${escapeHtml((hrReviewCases.length + unpaidActiveCases.length) - actionCases.length)} more items</span>
                <button class="text-btn" type="button" data-view="review">View queue</button>
              </div>
            ` : ''}
          </div>
        ` : '<div class="hr-action-empty" aria-label="No HR action items"></div>'}
      </section>
      <div class="dashboard-metric-grid">
        ${dashboardMetric('Open cases', openCases, 'C', 'cases')}
        ${dashboardMetric('Awaiting patient', awaitingPatient, 'P', 'cases')}
        ${dashboardMetric('With medical office', withDoctor, 'M', 'cases')}
        ${dashboardMetric('HR review', hrReviewCases.length, 'Q', 'review')}
      </div>
      ${renderHrOperationsPanel()}
    </div>
  `;
}

function renderHrOperationsPanel() {
  const rows = hrOperationsRows();
  return `
    <section class="panel hr-operations-panel">
      <div class="panel-header">
        <div>
          <h2>Operations queue</h2>
          <div class="muted">${rows.length ? `${rows.length} recent or waiting cases` : 'No active items'}</div>
        </div>
        <button class="secondary-btn" type="button" data-view="cases">View all cases</button>
      </div>
      <div class="panel-body">
        <div class="user-table hr-operations-table">
          ${rows.length ? `
            <div class="user-row user-row-head hr-operations-row">
              <strong>Case</strong>
              <strong>Status</strong>
              <strong>Priority</strong>
              <strong>Updated</strong>
              <strong>Action</strong>
            </div>
            ${rows.map((item) => `
              <div class="user-row hr-operations-row">
                <div class="managed-user-cell">
                  <strong>${escapeHtml(item.patientName || 'Patient')}</strong>
                  <span class="muted">${escapeHtml([item.employeeId, item.id].filter(Boolean).join(' · '))}</span>
                </div>
                <div class="plain-cell">${escapeHtml(item.statusLabel)}</div>
                <div class="plain-cell">${escapeHtml(item.priority)}</div>
                <time>${escapeHtml(formatDateTime(item.date))}</time>
                <div class="table-actions">
                  <button class="text-btn" type="button" data-dashboard-case-id="${escapeHtml(item.id)}">Open</button>
                </div>
              </div>
            `).join('')}
          ` : '<div class="empty">No cases need attention right now.</div>'}
        </div>
      </div>
    </section>
  `;
}

function hrOperationsRows() {
  const now = new Date().toISOString();
  const priorityRank = {
    'Needs HR review': 1,
    'Unpaid': 2,
    'With medical office': 3,
    'Awaiting patient': 4,
    'Recent update': 5
  };
  return [...(state.cases || [])]
    .map((medicalCase) => {
      const date = hrActivityDate(medicalCase);
      const priority = hrOperationPriority(medicalCase);
      return {
        ...medicalCase,
        date,
        priority,
        statusLabel: caseStatusLabels[medicalCase.status] || medicalCase.status,
        ageDays: daysBetween(date || medicalCase.createdAt, now)
      };
    })
    .filter((item) => item.date && !['archived', 'withdrawn', 'canceled_by_doctor'].includes(item.status))
    .sort((left, right) => {
      const priorityDelta = (priorityRank[left.priority] || 9) - (priorityRank[right.priority] || 9);
      if (priorityDelta !== 0) return priorityDelta;
      return right.date.localeCompare(left.date);
    })
    .slice(0, 10);
}

function hrOperationPriority(medicalCase) {
  if (medicalCase.status === 'doctor_submitted') return 'Needs HR review';
  if (doctorPaymentStatus(medicalCase) === 'unpaid' && ['reviewed', 'review_pending'].includes(medicalCase.status)) return 'Unpaid';
  if (['sent_to_doctor', 'review_pending'].includes(medicalCase.status)) return 'With medical office';
  if (medicalCase.status === 'sent_to_patient') return 'Awaiting patient';
  return 'Recent update';
}

function renderHrActivityPanel() {
  const activity = hrRecentActivityRows();
  const watchlist = hrWatchlistRows();
  return `
    <section class="panel hr-activity-panel">
      <div class="panel-header">
        <h2>Recent activity</h2>
        <button class="secondary-btn" type="button" data-view="cases">View cases</button>
      </div>
      <div class="panel-body">
        <div class="hr-activity-layout">
          <div class="hr-activity-list">
            ${activity.length ? activity.map((item) => `
              <button class="hr-activity-row" type="button" data-dashboard-case-id="${escapeHtml(item.id)}">
                <span>
                  <strong>${escapeHtml(item.patientName || 'Patient')}</strong>
                  <small>${escapeHtml(item.label)}</small>
                </span>
                <time>${escapeHtml(formatDateTime(item.date))}</time>
              </button>
            `).join('') : '<div class="empty">No case activity yet.</div>'}
          </div>
          <aside class="hr-watchlist" aria-label="Workflow watchlist">
            <h3>Watchlist</h3>
            ${watchlist.length ? watchlist.map((item) => `
              <button class="hr-watch-row" type="button" data-dashboard-case-id="${escapeHtml(item.id)}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.patientName || 'Patient')}</strong>
                <small>${escapeHtml(item.detail)}</small>
              </button>
            `).join('') : '<div class="hr-watch-empty"></div>'}
          </aside>
        </div>
      </div>
    </section>
  `;
}

function hrRecentActivityRows() {
  return [...(state.cases || [])]
    .map((medicalCase) => ({
      id: medicalCase.id,
      patientName: medicalCase.patientName,
      label: hrActivityLabel(medicalCase),
      date: hrActivityDate(medicalCase)
    }))
    .filter((item) => item.date)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
}

function hrWatchlistRows() {
  const now = new Date().toISOString();
  const oldest = (rows) => [...rows]
    .sort((left, right) => hrActivityDate(left).localeCompare(hrActivityDate(right)))
    .find(Boolean);
  const rows = [];
  const review = oldest((state.cases || []).filter((item) => item.status === 'doctor_submitted'));
  const doctor = oldest((state.cases || []).filter((item) => ['sent_to_doctor', 'review_pending'].includes(item.status)));
  const unpaid = oldest((state.cases || []).filter((item) => doctorPaymentStatus(item) === 'unpaid' && ['reviewed', 'review_pending'].includes(item.status)));
  if (review) rows.push({
    id: review.id,
    label: 'Oldest HR review',
    patientName: review.patientName,
    detail: `${daysBetween(review.submittedAt || review.updatedAt || review.createdAt, now)} days waiting`
  });
  if (doctor) rows.push({
    id: doctor.id,
    label: 'Oldest medical office item',
    patientName: doctor.patientName,
    detail: `${daysBetween(doctor.assignedAt || doctor.updatedAt || doctor.createdAt, now)} days open`
  });
  if (unpaid) rows.push({
    id: unpaid.id,
    label: 'Oldest unpaid case',
    patientName: unpaid.patientName,
    detail: `${daysBetween(unpaid.updatedAt || unpaid.submittedAt || unpaid.createdAt, now)} days unpaid`
  });
  return rows.slice(0, 3);
}

function hrActivityLabel(medicalCase) {
  const status = medicalCase.status;
  if (status === 'doctor_submitted') return 'Submitted by medical office for HR review';
  if (status === 'reviewed') return `HR reviewed, billing ${paymentStatusLabel(doctorPaymentStatus(medicalCase)).toLowerCase()}`;
  if (status === 'sent_to_patient') return 'Sent to patient for completion';
  if (status === 'patient_completed') return 'Patient completed medical form';
  if (status === 'sent_to_doctor') return 'Sent to medical office';
  if (status === 'review_pending') return 'Medical office work in progress';
  if (status === 'canceled_by_doctor') return 'Canceled by medical office';
  if (status === 'withdrawn') return 'Withdrawn';
  return caseStatusLabels[status] || 'Case updated';
}

function hrActivityDate(medicalCase) {
  return medicalCase.submittedAt || medicalCase.updatedAt || medicalCase.assignedAt || medicalCase.createdAt || '';
}

function hrDashboardActionCard({ title, value, description, view, tone }) {
  return `
    <button class="hr-action-card is-${escapeHtml(tone)}" type="button" data-view="${escapeHtml(view)}" ${Number(value) > 0 ? '' : 'disabled'}>
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(description)}</small>
    </button>
  `;
}

function dashboardShortcut(label, icon, view) {
  return `
    <button class="dashboard-shortcut" type="button" data-view="${escapeHtml(view)}">
      <span class="shortcut-icon" aria-hidden="true">${navIcon(icon)}</span>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function dashboardMetric(label, value, icon, view) {
  const tag = view ? 'button' : 'div';
  const attrs = view ? `type="button" data-view="${escapeHtml(view)}"` : '';
  return `
    <${tag} class="dashboard-metric" ${attrs}>
      <span class="metric-icon" aria-hidden="true">${navIcon(icon)}</span>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </${tag}>
  `;
}

function moduleListItem(title, description, icon, view) {
  return `
    <button class="module-list-item" type="button" data-view="${escapeHtml(view)}">
      <span class="shortcut-icon" aria-hidden="true">${navIcon(icon)}</span>
      <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
      <span aria-hidden="true">&rsaquo;</span>
    </button>
  `;
}

function moduleCard(title, count, view) {
  return `
    <button class="module-card" type="button" data-view="${escapeHtml(view)}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(count)}</strong>
    </button>
  `;
}

function bindHrDashboard() {
  if (!state.hrModuleLoaded) loadHrModuleData();
  document.querySelectorAll('.module-card[data-view], .dashboard-metric[data-view], .module-list-item[data-view], .dashboard-titlebar [data-view], .hr-action-card[data-view], .hr-action-panel [data-view], .hr-activity-panel [data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderShell();
    });
  });
  document.querySelectorAll('[data-dashboard-case-id]').forEach((button) => {
    button.addEventListener('click', () => openDetailModal('case', button.dataset.dashboardCaseId));
  });
  bindDetailModal();
}

async function loadHrModuleData() {
  const [usersResponse, patientsResponse, cliniciansResponse, casesResponse, reportResponse] = await Promise.all([
    api('/api/user-management/users').catch(() => ({ users: [] })),
    api('/api/candidates').catch(() => ({ candidates: [] })),
    api('/api/setup/clinicians').catch(() => ({ clinicians: [] })),
    api('/api/cases').catch(() => ({ cases: [] })),
    api('/api/reports/monthly-doctors').catch(() => ({ report: [] }))
  ]);
  state.users = usersResponse.users || [];
  state.candidates = patientsResponse.candidates || [];
  state.clinicians = cliniciansResponse.clinicians || [];
  state.cases = casesResponse.cases || [];
  state.monthlyReport = reportResponse.report || [];
  state.hrModuleLoaded = true;
  if (state.view === 'hr-dashboard') renderContent();
}

function renderUserManagement() {
  const filteredUsers = filteredManagedUsers();
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>User Management</h2>
            <div class="muted">${filteredUsers.length} shown</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" type="button" data-action="refresh-managed-users">Refresh</button>
            <button class="primary-btn compact-primary" type="button" data-action="open-create-user-modal">New user</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="field inline-filter">
            <label class="sr-only" for="managedUserSearch">Search users</label>
            <input id="managedUserSearch" type="search" value="${escapeHtml(state.userSearch)}" placeholder="Search users">
          </div>
          <div id="managedUserMessage" class="notice is-quiet" role="status">${escapeHtml(state.userManagementMessage)}</div>
          <div class="user-table managed-users-table" id="managedUserTable">${renderManagedUserRows(filteredUsers)}</div>
        </div>
      </section>
    </div>
    ${renderManagedUserModal()}
    ${renderDetailModal()}
  `;
}

function bindUserManagement() {
  loadManagedUsers();
  document.querySelector('[data-action="refresh-managed-users"]')?.addEventListener('click', () => {
    state.userManagementMessage = '';
    loadManagedUsers();
  });
  document.querySelector('[data-action="open-create-user-modal"]')?.addEventListener('click', () => {
    state.showCreateManagedUserModal = true;
    state.managedUserPrefill = null;
    state.userManagementMessage = '';
    renderContent();
  });
  const searchUsers = debounce(async (query) => {
    await loadManagedUsers(query);
  }, 250);
  document.querySelector('#managedUserSearch')?.addEventListener('input', (event) => {
    state.userSearch = event.currentTarget.value;
    searchUsers(state.userSearch);
  });
  bindManagedUserModal();
}

async function loadManagedUsers(query = state.userSearch) {
  const table = document.querySelector('#managedUserTable');
  const message = document.querySelector('#managedUserMessage');
  try {
    const response = await api(`/api/user-management/users?limit=100&q=${encodeURIComponent(query || '')}`);
    state.users = response.users || [];
    if (message && !state.userManagementMessage) message.textContent = '';
  } catch (err) {
    if (state.user?.role === ROLES.ADMIN) {
      const fallback = await api(`/api/admin/users?limit=100&q=${encodeURIComponent(query || '')}`);
      state.users = fallback.users || [];
      if (message && !state.userManagementMessage) message.textContent = '';
    } else {
      const [cliniciansResponse, reviewersResponse] = await Promise.all([
        api('/api/setup/clinicians').catch(() => ({ clinicians: [] })),
        api('/api/setup/reviewers').catch(() => ({ reviewers: [] }))
      ]);
      state.users = [
        ...(cliniciansResponse.clinicians || []),
        ...(reviewersResponse.reviewers || [])
      ];
      if (message) message.textContent = `User Management endpoint is unavailable: ${err.message}. Restart the server to load all user types.`;
    }
  }
  if (!table) return;
  table.innerHTML = renderManagedUserRows(filteredManagedUsers());
  bindManagedUserRows();
}

function filteredManagedUsers() {
  const query = state.userSearch.trim().toLowerCase();
  return (state.users || []).filter((user) => !query || [
    user.displayName,
    user.email,
    roleLabel(user.role),
    user.medicalProfile?.facilityName,
    user.medicalProfile?.clinicianName
  ].join(' ').toLowerCase().includes(query));
}

function renderManagedUserRows(users = []) {
  if (!users.length) return '<div class="empty">No users found.</div>';
  return `
    <div class="user-row user-row-head">
      <strong>User</strong>
      <strong>Type</strong>
      <strong>Status</strong>
      <strong>Action</strong>
    </div>
    ${users.map((user) => `
      <div class="user-row managed-user-row" data-managed-user-id="${escapeHtml(user.id)}">
        <div class="managed-user-cell">
          <strong>${escapeHtml(user.displayName)}</strong>
          <span class="muted">${escapeHtml(user.email)}</span>
        </div>
        <div class="plain-cell">
          ${escapeHtml(roleLabel(user.role))}
        </div>
        <span class="plain-status ${user.active ? 'is-active' : 'is-inactive'}">${user.active ? 'Active' : 'Inactive'}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-action="edit-managed-user" data-user-id="${escapeHtml(user.id)}">Edit</button>
          ${state.user?.role === ROLES.ADMIN ? `<button class="text-btn danger-text" type="button" data-action="delete-managed-user" data-user-id="${escapeHtml(user.id)}" ${user.id === state.user.id ? 'disabled' : ''}>Delete</button>` : ''}
        </div>
      </div>
    `).join('')}
  `;
}

function bindManagedUserRows() {
  document.querySelectorAll('[data-action="edit-managed-user"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingManagedUserId = button.dataset.userId;
      renderContent();
    });
  });
  document.querySelectorAll('[data-action="delete-managed-user"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.deletingManagedUserId = button.dataset.userId;
      state.editingManagedUserId = '';
      state.userManagementMessage = '';
      renderContent();
    });
  });
  bindManagedUserModal();
}

function renderManagedUserModal() {
  if (state.showCreateManagedUserModal) {
    const prefill = state.managedUserPrefill || {};
    const isPatientPrefill = prefill.role === ROLES.PATIENT && prefill.patientId;
    return `
      <div class="modal-backdrop" data-action="close-managed-user-modal">
        <section class="modal-content managed-user-modal" role="dialog" aria-modal="true" aria-label="Create user">
          <div class="managed-modal-header">
            <div class="managed-modal-identity">
              <span class="avatar is-large" aria-hidden="true">+</span>
              <div>
                <h2>New user</h2>
                <span>${isPatientPrefill ? 'Create patient access from Patient Management.' : 'Create access for one person.'}</span>
              </div>
            </div>
            <button class="icon-close-btn" type="button" data-action="close-managed-user-modal" aria-label="Close">&times;</button>
          </div>
          <form id="managedUserCreateForm" class="managed-user-edit-form">
            <div class="managed-modal-body">
              <section class="managed-form-section">
                <div class="grid-2">
                  ${field('displayName', 'Display name', 'text', true, prefill.displayName || '')}
                  ${field('email', 'Email', 'email', true, prefill.email || '')}
                </div>
              </section>
              <section class="managed-form-section">
                <div class="managed-access-grid">
                  <div class="field">
                    <label for="managedCreateRole">User type</label>
                    <select id="managedCreateRole" name="role" required ${isPatientPrefill ? 'disabled' : ''}>
                      ${managedRoleOptions(prefill.role || '')}
                    </select>
                  </div>
                  ${passwordInputField('managedCreatePassword', 'Temporary password', 'new-password').replaceAll('name="managedCreatePassword"', 'name="password"').replace(isPatientPrefill ? ' required' : '', '')}
                </div>
                ${isPatientPrefill ? '<div class="notice is-quiet">Leave temporary password blank to generate one.</div>' : ''}
              </section>
              ${isPatientPrefill ? '' : `
                <section class="managed-form-section role-create-section" data-role-section="patient" hidden>
                  <div class="section-heading compact-section-heading">
                    <div>
                      <h3>Patient profile</h3>
                      <span>Created with the patient user account.</span>
                    </div>
                  </div>
                  <div class="grid-2">
                    ${field('patientProfile.dateOfBirth', 'Date of birth', 'date', false)}
                    ${field('patientProfile.position', 'Position applied for', 'text', false)}
                    ${field('patientProfile.employeeId', 'Applicant ID', 'text', false)}
                    ${field('patientProfile.nationalId', 'TRN / national ID', 'text', false)}
                    ${field('patientProfile.contactNumber', 'Phone number', 'tel', false)}
                  </div>
                  ${textarea('patientProfile.address', 'Address')}
                </section>
                <section class="managed-form-section role-create-section" data-role-section="doctor" hidden>
                  <div class="section-heading compact-section-heading">
                    <div>
                      <h3>Medical office profile</h3>
                      <span>Classify this person as the responsible doctor or support clinician.</span>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div class="field">
                      <label for="medicalProfile-officeUserType">Office user type</label>
                      <select id="medicalProfile-officeUserType" name="medicalProfile.officeUserType">
                        <option value="doctor" ${prefill.medicalProfile?.officeUserType === 'doctor' ? 'selected' : ''}>Doctor</option>
                        <option value="clinician" ${prefill.medicalProfile?.officeUserType === 'clinician' ? 'selected' : ''}>Clinician / support</option>
                      </select>
                    </div>
                    ${field('medicalProfile.clinicianName', 'Doctor / clinician name', 'text', false, prefill.displayName || '')}
                    <div data-doctor-rate-field>
                      ${field('medicalProfile.defaultMedicalFee', 'Doctor rate', 'number', false, prefill.medicalProfile?.defaultMedicalFee || '')}
                    </div>
                  </div>
                </section>
              `}
              <div id="managedCreateUserMessage" class="notice is-quiet" role="status"></div>
            </div>
            <div class="managed-modal-footer">
              <button class="secondary-btn" type="button" data-action="close-managed-user-modal">Cancel</button>
              <button class="primary-btn" type="submit">Create user</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  const deleteUser = (state.users || []).find((item) => item.id === state.deletingManagedUserId);
  if (deleteUser) {
    const isDoctor = deleteUser.role === ROLES.DOCTOR;
    const isPatient = deleteUser.role === ROLES.PATIENT;
    return `
      <div class="modal-backdrop" data-action="close-managed-user-modal">
        <section class="modal-content managed-user-modal delete-user-modal" role="dialog" aria-modal="true" aria-label="Delete user">
          <div class="managed-modal-header">
            <div class="managed-modal-identity">
              <span class="avatar is-large is-danger" aria-hidden="true">!</span>
              <div>
                <h2>Delete user</h2>
                <span>${escapeHtml(deleteUser.displayName)} · ${escapeHtml(deleteUser.email)}</span>
              </div>
            </div>
            <button class="icon-close-btn" type="button" data-action="close-managed-user-modal" aria-label="Close">&times;</button>
          </div>
          <div class="managed-modal-body">
            <section class="managed-form-section delete-warning-section">
              <h3>This removes sign-in access</h3>
              <p class="muted">The account will be deleted and this email or username can be used by another account.</p>
              <ul class="delete-impact-list">
                <li>Active sessions for this user will be revoked.</li>
                ${isPatient ? '<li>The linked patient profile remains, but patient login access is removed.</li>' : ''}
                ${isDoctor ? '<li>Doctor or clinician office assignments are removed.</li>' : ''}
                ${isDoctor ? '<li>Unprocessed active cases assigned to this user are returned to unassigned.</li>' : ''}
                ${isDoctor ? '<li>Cases already processed by the doctor remain in the medical history and reports.</li>' : '<li>Completed medical records remain available for audit and case history.</li>'}
              </ul>
            </section>
          </div>
          <div class="managed-modal-footer">
            <button class="secondary-btn" type="button" data-action="close-managed-user-modal">Cancel</button>
            <button class="primary-btn danger-btn" type="button" data-action="confirm-delete-managed-user" data-user-id="${escapeHtml(deleteUser.id)}">Delete user</button>
          </div>
        </section>
      </div>
    `;
  }

  const user = (state.users || []).find((item) => item.id === state.editingManagedUserId);
  if (!user) return '';
  const initials = getInitials(user.displayName);
  return `
    <div class="modal-backdrop" data-action="close-managed-user-modal">
      <section class="modal-content managed-user-modal" role="dialog" aria-modal="true" aria-label="Edit user">
        <div class="managed-modal-header">
          <div class="managed-modal-identity">
            <span class="avatar is-large" aria-hidden="true">${escapeHtml(initials)}</span>
            <div>
              <h2>${escapeHtml(user.displayName)}</h2>
              <span>${escapeHtml(user.email)}</span>
            </div>
          </div>
          <button class="icon-close-btn" type="button" data-action="close-managed-user-modal" aria-label="Close">&times;</button>
        </div>

        <form id="managedUserEditForm" class="managed-user-edit-form" data-user-id="${escapeHtml(user.id)}">
          <div class="managed-modal-body">
            <section class="managed-form-section">
              <div class="section-heading compact-section-heading">
                <div>
                  <h3>Account details</h3>
                  <span>Basic identity and sign-in information.</span>
                </div>
              </div>
              <div class="grid-2">
              ${field('displayName', 'Display name', 'text', true, user.displayName)}
              ${field('email', 'Email', 'email', true, user.email)}
              </div>
            </section>

            ${user.role === ROLES.DOCTOR ? `
              <section class="managed-form-section">
                <div class="section-heading compact-section-heading">
                  <div>
                    <h3>Medical office profile</h3>
                    <span>Doctor rate overrides the medical office fee in billing reports.</span>
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field">
                    <label for="medicalProfile-officeUserType">Office user type</label>
                    <select id="medicalProfile-officeUserType" name="medicalProfile.officeUserType">
                      <option value="doctor" ${medicalOfficeUserType(user) === 'doctor' ? 'selected' : ''}>Doctor</option>
                      <option value="clinician" ${medicalOfficeUserType(user) === 'clinician' ? 'selected' : ''}>Clinician / support</option>
                    </select>
                  </div>
                  ${field('medicalProfile.clinicianName', 'Doctor / clinician name', 'text', false, user.medicalProfile?.clinicianName || user.displayName)}
                  ${field('medicalProfile.defaultMedicalFee', 'Doctor rate', 'number', false, user.medicalProfile?.defaultMedicalFee || '')}
                </div>
              </section>
            ` : ''}

            <section class="managed-form-section">
              <div class="section-heading compact-section-heading">
                <div>
                  <h3>Access</h3>
                  <span>Role and account availability.</span>
                </div>
              </div>
              <div class="managed-access-grid">
              <div class="field">
                <label for="managedEditRole">User type</label>
                <select id="managedEditRole" name="role" ${user.id === state.user.id ? 'disabled' : ''}>
                  ${managedRoleOptions(user.role)}
                </select>
              </div>
              <div class="field">
                <label for="managedEditActive">Status</label>
                <select id="managedEditActive" name="active" ${user.id === state.user.id ? 'disabled' : ''}>
                  <option value="true" ${user.active ? 'selected' : ''}>Active</option>
                  <option value="false" ${!user.active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              </div>
              ${user.id === state.user.id ? '<div class="notice is-quiet">You cannot deactivate your own account or change your own role from this screen.</div>' : ''}
            </section>

            <section class="managed-form-section">
              <div class="section-heading compact-section-heading">
                <div>
                  <h3>Password reset</h3>
                  <span>Leave blank if the password should not change.</span>
                </div>
              </div>
              <div class="managed-password-row">
                ${field('password', 'New password', 'password', false)}
              </div>
              <button class="secondary-btn compact-primary" type="button" data-action="send-managed-user-reset" data-user-id="${escapeHtml(user.id)}">Send reset link</button>
              <div id="managedResetMessage" class="notice is-quiet" role="status"></div>
            </section>
          </div>

          <div class="managed-modal-footer">
            <button class="secondary-btn" type="button" data-action="close-managed-user-modal">Cancel</button>
            <button class="primary-btn" type="submit">Save changes</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function bindManagedUserModal() {
  bindPasswordVisibility(document);
  document.querySelectorAll('[data-action="close-managed-user-modal"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target !== element && element.classList.contains('modal-backdrop')) return;
      state.editingManagedUserId = '';
      state.deletingManagedUserId = '';
      state.showCreateManagedUserModal = false;
      state.managedUserPrefill = null;
      renderContent();
    });
  });
  document.querySelector('[data-action="confirm-delete-managed-user"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Deleting...';
    try {
      const response = await api(`/api/user-management/users/${encodeURIComponent(button.dataset.userId)}`, {
        method: 'DELETE'
      });
      state.deletingManagedUserId = '';
      state.userManagementMessage = response.message || 'User deleted.';
      state.patientManagementLoaded = false;
      await loadManagedUsers();
      renderContent();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Delete user';
      state.userManagementMessage = err.message;
      const message = document.querySelector('#managedUserMessage');
      if (message) message.textContent = err.message;
    }
  });
  document.querySelector('#managedUserCreateForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    const data = new FormData(form);
    const message = document.querySelector('#managedCreateUserMessage');
    const submit = form.querySelector('button[type="submit"]');
    if (message) message.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Creating...';
    try {
      const prefill = state.managedUserPrefill || {};
      const creatingLinkedPatient = Boolean(prefill.patientId);
      if (creatingLinkedPatient) {
        await api(`/api/candidates/${encodeURIComponent(prefill.patientId)}`, {
          method: 'PATCH',
          body: {
            fullName: data.get('displayName'),
            email: data.get('email')
          }
        });
        const response = await api(`/api/candidates/${encodeURIComponent(prefill.patientId)}/user`, {
          method: 'POST',
          body: {
            password: data.get('password'),
            resetPassword: true
          }
        });
        state.userManagementMessage = `Patient user created and linked. ${response.notification?.message || ''}`.trim();
      } else {
        const response = await api('/api/user-management/users', {
          method: 'POST',
          body: {
            email: data.get('email'),
            displayName: data.get('displayName'),
            role: data.get('role'),
            password: data.get('password'),
            medicalProfile: collect(data, 'medicalProfile', ['officeUserType', 'clinicianName', 'defaultMedicalFee']),
            patientProfile: collect(data, 'patientProfile', ['dateOfBirth', 'position', 'employeeId', 'nationalId', 'contactNumber', 'address'])
          }
        });
        state.userManagementMessage = `User created. ${response.notification?.message || ''}`.trim();
      }
      state.showCreateManagedUserModal = false;
      state.managedUserPrefill = null;
      state.patientManagementLoaded = false;
      await loadManagedUsers();
      renderContent();
    } catch (err) {
      if (message) message.textContent = err.message;
      submit.disabled = false;
      submit.textContent = 'Create user';
      form.dataset.submitting = 'false';
    }
  });
  bindManagedUserCreateRoleFields();
  document.querySelector('#managedUserEditForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      displayName: data.get('displayName'),
      email: data.get('email'),
      role: data.get('role') || undefined,
      active: data.get('active') !== 'false'
    };
    if (data.get('password')) body.password = data.get('password');
    if (data.has('medicalProfile.officeUserType') || data.has('medicalProfile.defaultMedicalFee') || data.has('medicalProfile.clinicianName')) {
      body.medicalProfile = collect(data, 'medicalProfile', ['officeUserType', 'clinicianName', 'defaultMedicalFee']);
    }
    await api(`/api/user-management/users/${encodeURIComponent(form.dataset.userId)}`, {
      method: 'PATCH',
      body
    });
    state.editingManagedUserId = '';
    await loadManagedUsers();
  });
  document.querySelector('[data-action="send-managed-user-reset"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const message = document.querySelector('#managedResetMessage');
    button.disabled = true;
    button.textContent = 'Sending...';
    try {
      const response = await api(`/api/user-management/users/${encodeURIComponent(button.dataset.userId)}/password-reset`, {
        method: 'POST'
      });
      message.textContent = response.message;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Send reset link';
    }
  });
}

function bindManagedUserCreateRoleFields() {
  const form = document.querySelector('#managedUserCreateForm');
  const roleSelect = form?.querySelector('#managedCreateRole');
  const patientSection = form?.querySelector('[data-role-section="patient"]');
  const doctorSection = form?.querySelector('[data-role-section="doctor"]');
  const officeUserTypeSelect = form?.elements['medicalProfile.officeUserType'];
  const doctorRateField = form?.querySelector('[data-doctor-rate-field]');
  if (!form || !roleSelect) return;
  const requiredNames = ['patientProfile.dateOfBirth', 'patientProfile.position'];
  const update = () => {
    const isPatient = roleSelect.value === ROLES.PATIENT;
    const isDoctor = roleSelect.value === ROLES.DOCTOR;
    if (patientSection) patientSection.hidden = !isPatient;
    if (doctorSection) doctorSection.hidden = !isDoctor;
    if (doctorRateField) doctorRateField.hidden = officeUserTypeSelect?.value === 'clinician';
    requiredNames.forEach((name) => {
      const control = form.elements[name];
      if (control) control.required = isPatient;
    });
  };
  roleSelect.addEventListener('change', update);
  officeUserTypeSelect?.addEventListener('change', update);
  update();
}

function managedRoleOptions(selected = '') {
  const roles = state.user?.role === ROLES.ADMIN ? Object.values(ROLES) : [ROLES.DOCTOR, ROLES.REVIEWER, ROLES.PATIENT];
  return roles.map((role) => `<option value="${escapeHtml(role)}" ${selected === role ? 'selected' : ''}>${escapeHtml(roleLabel(role))}</option>`).join('');
}

function renderDoctorManagement() {
  const selectedDoctor = selectedManagedDoctor();
  if (selectedDoctor) {
    return `
      <div class="admin-grid">
        <section class="panel">
          ${renderDoctorManagementDashboard(selectedDoctor)}
        </section>
      </div>
      ${renderDetailModal()}
    `;
  }
  const doctors = filteredManagedDoctors();
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Doctor Management</h2>
            <div class="muted">${doctors.length} shown</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" type="button" data-action="doctor-management-refresh">Refresh</button>
            <button class="primary-btn compact-primary" type="button" data-action="doctor-management-new-user">New doctor</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="field inline-filter">
            <label class="sr-only" for="doctorManagementSearch">Search doctors</label>
            <input id="doctorManagementSearch" type="search" value="${escapeHtml(state.doctorManagementSearch)}" placeholder="Search doctor, email, office, registration number">
          </div>
          <div class="user-table doctor-management-table" id="doctorManagementTable">
            ${renderDoctorManagementRows(doctors)}
          </div>
        </div>
      </section>
    </div>
  `;
}

function bindDoctorManagement() {
  loadDoctorManagementData();
  document.querySelector('[data-action="doctor-management-refresh"]')?.addEventListener('click', loadDoctorManagementData);
  document.querySelector('[data-action="doctor-management-new-user"]')?.addEventListener('click', () => {
    state.view = 'user-management';
    state.showCreateManagedUserModal = true;
    state.managedUserPrefill = { role: ROLES.DOCTOR, medicalProfile: { officeUserType: 'doctor' } };
    renderContent();
  });
  document.querySelector('#doctorManagementSearch')?.addEventListener('input', (event) => {
    state.doctorManagementSearch = event.currentTarget.value;
    const table = document.querySelector('#doctorManagementTable');
    if (table) table.innerHTML = renderDoctorManagementRows(filteredManagedDoctors());
    bindDoctorManagementRows();
  });
  document.querySelector('[data-action="back-to-doctor-management"]')?.addEventListener('click', () => {
    state.selectedManagedDoctorId = '';
    state.doctorManagementCaseSearch = '';
    state.doctorManagementCasePage = 1;
    renderContent();
  });
  document.querySelector('#doctorManagementCaseSearch')?.addEventListener('input', (event) => {
    state.doctorManagementCaseSearch = event.currentTarget.value;
    state.doctorManagementCasePage = 1;
    renderContent();
  });
  document.querySelector('[data-action="doctor-case-prev-page"]')?.addEventListener('click', () => {
    state.doctorManagementCasePage = Math.max(1, state.doctorManagementCasePage - 1);
    renderContent();
  });
  document.querySelector('[data-action="doctor-case-next-page"]')?.addEventListener('click', () => {
    state.doctorManagementCasePage += 1;
    renderContent();
  });
  bindDoctorManagementRows();
  bindDetailModal();
}

async function loadDoctorManagementData() {
  const [officeResponse, clinicianResponse, casesResponse] = await Promise.all([
    api('/api/medical-offices'),
    api('/api/setup/clinicians'),
    api('/api/cases')
  ]);
  state.medicalOffices = officeResponse.offices || [];
  state.clinicians = clinicianResponse.clinicians || [];
  state.cases = casesResponse.cases || [];
  const table = document.querySelector('#doctorManagementTable');
  if (table) table.innerHTML = renderDoctorManagementRows(filteredManagedDoctors());
  bindDoctorManagementRows();
}

function managedDoctors() {
  return (state.clinicians || []).filter((user) => user.active !== false && isDoctorOfficeUser(user));
}

function selectedManagedDoctor() {
  return managedDoctors().find((doctor) => doctor.id === state.selectedManagedDoctorId) || null;
}

function filteredManagedDoctors() {
  const query = state.doctorManagementSearch.trim().toLowerCase();
  return managedDoctors().filter((doctor) => {
    const offices = officesForDoctor(doctor).map((office) => office.name).join(' ');
    const profile = doctor.medicalProfile || {};
    return !query || [
      doctor.displayName,
      doctor.email,
      profile.clinicianName,
      profile.registrationNumber,
      profile.facilityName,
      offices
    ].join(' ').toLowerCase().includes(query);
  });
}

function renderDoctorManagementRows(doctors = filteredManagedDoctors()) {
  if (!doctors.length) return '<div class="empty">No doctors found.</div>';
  return `
    <div class="user-row user-row-head doctor-management-row">
      <strong>Doctor</strong>
      <strong>Office</strong>
      <strong>Rate</strong>
      <strong>Processed</strong>
      <strong>Action</strong>
    </div>
    ${doctors.map((doctor) => {
      const offices = officesForDoctor(doctor);
      const cases = doctorCases(doctor);
      const processed = processedDoctorCases(doctor);
      return `
        <div class="user-row doctor-management-row">
          <div>
            <strong>${escapeHtml(doctor.displayName)}</strong>
            <div class="muted">${escapeHtml([doctor.email, doctor.medicalProfile?.registrationNumber].filter(Boolean).join(' | ') || 'No profile details recorded')}</div>
          </div>
          <span>${escapeHtml(offices.map((office) => office.name).join(', ') || 'Unassigned')}</span>
          <span>${escapeHtml(doctor.medicalProfile?.defaultMedicalFee ? formatCurrency(doctor.medicalProfile.defaultMedicalFee) : 'Not set')}</span>
          <span>${processed.length} of ${cases.length}</span>
          <div class="table-actions">
            <button class="text-btn" type="button" data-select-managed-doctor="${escapeHtml(doctor.id)}">View</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function bindDoctorManagementRows() {
  document.querySelectorAll('[data-select-managed-doctor]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = 'doctor-management';
      state.selectedManagedDoctorId = button.dataset.selectManagedDoctor;
      state.selectedMedicalOfficeId = '';
      state.doctorManagementCaseSearch = '';
      state.doctorManagementCasePage = 1;
      renderContent();
    });
  });
  document.querySelectorAll('[data-doctor-office-link]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedMedicalOfficeId = button.dataset.doctorOfficeLink;
      state.view = 'medical-offices';
      state.selectedManagedDoctorId = '';
      renderContent();
    });
  });
  document.querySelectorAll('[data-open-doctor-case]').forEach((button) => {
    button.addEventListener('click', () => openDetailModal('case', button.dataset.openDoctorCase));
  });
}

function renderDoctorManagementDashboard(doctor) {
  const offices = officesForDoctor(doctor);
  const cases = doctorCases(doctor);
  const processed = processedDoctorCases(doctor);
  const open = cases.filter((medicalCase) => ['sent_to_doctor', 'review_pending'].includes(medicalCase.status));
  const thisMonth = processed.filter((medicalCase) => isCurrentMonth(medicalCase.submittedAt || medicalCase.updatedAt));
  const unpaid = processed.filter((medicalCase) => doctorPaymentStatus(medicalCase) === 'unpaid');
  const paid = processed.filter((medicalCase) => doctorPaymentStatus(medicalCase) === 'paid');
  const payable = processed.reduce((total, medicalCase) => total + Number(medicalCase.payableAmount || doctor.medicalProfile?.defaultMedicalFee || 0), 0);
  const filtered = filteredDoctorCases(doctor);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.doctorManagementCasePage = Math.min(state.doctorManagementCasePage, pageCount);
  const pageRows = filtered.slice((state.doctorManagementCasePage - 1) * pageSize, state.doctorManagementCasePage * pageSize);
  return `
    <div class="panel-header patient-detail-header">
      <div>
        <button class="text-btn patient-back-btn" type="button" data-action="back-to-doctor-management">Back to doctors</button>
        <h2>${escapeHtml(doctor.displayName)}</h2>
        <div class="muted">${escapeHtml([doctor.email, doctor.medicalProfile?.registrationNumber].filter(Boolean).join(' | ') || 'No profile details recorded')}</div>
      </div>
      <div class="header-actions">
        ${offices[0] ? `<button class="secondary-btn compact-primary" type="button" data-doctor-office-link="${escapeHtml(offices[0].id)}">Open office</button>` : ''}
      </div>
    </div>
    <div class="panel-body form-stack">
      <div class="doctor-profile-band">
        <div>
          <span class="eyebrow">Assigned office</span>
          <strong>${escapeHtml(offices.map((office) => office.name).join(', ') || 'Unassigned')}</strong>
          <small>${escapeHtml(offices.map((office) => office.address).filter(Boolean).join(' | ') || 'No office address recorded')}</small>
        </div>
        <div>
          <span class="eyebrow">Doctor rate</span>
          <strong>${escapeHtml(doctor.medicalProfile?.defaultMedicalFee ? formatCurrency(doctor.medicalProfile.defaultMedicalFee) : 'Not set')}</strong>
          <small>Used before office fee in billing reports.</small>
        </div>
      </div>
      <div class="dashboard-metric-grid">
        ${dashboardMetric('Assigned cases', cases.length, 'C')}
        ${dashboardMetric('Open cases', open.length, 'D')}
        ${dashboardMetric('Processed this month', thisMonth.length, 'Q')}
        ${dashboardMetric('Total processed', processed.length, 'S')}
        ${dashboardMetric('Unpaid', unpaid.length, 'R')}
        ${dashboardMetric('Paid', paid.length, 'A')}
        ${dashboardMetric('Processed value', formatCurrency(payable), '$')}
      </div>
      <section class="patient-medical-history">
        <div class="section-heading-row">
          <h3>Doctor cases</h3>
          <span>${filtered.length} shown</span>
        </div>
        <div class="field inline-filter">
          <label class="sr-only" for="doctorManagementCaseSearch">Search doctor cases</label>
          <input id="doctorManagementCaseSearch" type="search" value="${escapeHtml(state.doctorManagementCaseSearch)}" placeholder="Search patient, case ID, stage, billing status">
        </div>
        <div class="user-table doctor-case-management-table">
          ${renderDoctorManagementCaseRows(pageRows)}
        </div>
        <div class="pagination-bar">
          <button class="secondary-btn" type="button" data-action="doctor-case-prev-page" ${state.doctorManagementCasePage <= 1 ? 'disabled' : ''}>Previous</button>
          <span>Page ${state.doctorManagementCasePage} of ${pageCount}</span>
          <button class="secondary-btn" type="button" data-action="doctor-case-next-page" ${state.doctorManagementCasePage >= pageCount ? 'disabled' : ''}>Next</button>
        </div>
      </section>
    </div>
  `;
}

function renderDoctorManagementCaseRows(cases) {
  if (!cases.length) return '<div class="empty">No cases found for this doctor.</div>';
  return `
    <div class="user-row user-row-head doctor-case-management-row">
      <strong>Case</strong>
      <strong>Stage</strong>
      <strong>Billing</strong>
      <strong>Processed</strong>
      <strong>Action</strong>
    </div>
    ${cases.map((medicalCase) => `
      <div class="user-row doctor-case-management-row">
        <div>
          <strong>${escapeHtml(medicalCase.patientName || medicalCase.id)}</strong>
          <div class="muted">${escapeHtml(medicalCase.id)} | ${escapeHtml(medicalCase.patientEmail || 'No email')}</div>
        </div>
        <span>${escapeHtml(caseStageLabel(medicalCase))}</span>
        <span>${escapeHtml(paymentStatusLabel(doctorPaymentStatus(medicalCase)))}${medicalCase.payableAmount ? ` | ${escapeHtml(formatCurrency(medicalCase.payableAmount))}` : ''}</span>
        <span>${escapeHtml(formatDateTime(medicalCase.submittedAt || medicalCase.updatedAt))}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-open-doctor-case="${escapeHtml(medicalCase.id)}">Open</button>
        </div>
      </div>
    `).join('')}
  `;
}

function officesForDoctor(doctor) {
  return (state.medicalOffices || []).filter((office) => office.active !== false && (office.assignedClinicianIds || []).includes(doctor.id));
}

function doctorCases(doctor) {
  return (state.cases || []).filter((medicalCase) => medicalCase.assignedClinicianId === doctor.id);
}

function processedDoctorCases(doctor) {
  return doctorCases(doctor).filter((medicalCase) => ['doctor_submitted', 'review_pending', 'reviewed', 'archived'].includes(medicalCase.status));
}

function filteredDoctorCases(doctor) {
  const query = state.doctorManagementCaseSearch.trim().toLowerCase();
  return doctorCases(doctor).filter((medicalCase) => !query || [
    medicalCase.id,
    medicalCase.patientName,
    medicalCase.patientEmail,
    caseStageLabel(medicalCase),
    caseStatusLabels[medicalCase.status],
    paymentStatusLabel(doctorPaymentStatus(medicalCase))
  ].join(' ').toLowerCase().includes(query));
}

function isCurrentMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function renderMedicalOfficeManagement() {
  const selectedOffice = selectedMedicalOffice();
  if (selectedOffice) {
    return `
      <div class="admin-grid">
        <section class="panel">
          ${renderMedicalOfficeDashboard(selectedOffice)}
        </section>
      </div>
      ${renderMedicalOfficeModal()}
      ${renderDetailModal()}
    `;
  }
  const offices = filteredMedicalOffices();
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Medical Office Management</h2>
            <div class="muted">${offices.length} shown</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" type="button" data-action="refresh-medical-offices">Refresh</button>
            <button class="primary-btn compact-primary" type="button" data-action="new-medical-office">New office</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="field inline-filter">
            <label class="sr-only" for="medicalOfficeSearch">Search medical offices</label>
            <input id="medicalOfficeSearch" type="search" value="${escapeHtml(state.medicalOfficeSearch)}" placeholder="Search office, address, phone, email">
          </div>
          <div id="medicalOfficeMessage" class="notice is-quiet" role="status"></div>
          <div class="user-table medical-office-table" id="medicalOfficeTable">
            ${renderMedicalOfficeRows(offices)}
          </div>
        </div>
      </section>
    </div>
    ${renderMedicalOfficeModal()}
  `;
}

function bindMedicalOfficeManagement() {
  loadMedicalOfficeData();
  document.querySelector('[data-action="refresh-medical-offices"]')?.addEventListener('click', loadMedicalOfficeData);
  document.querySelector('[data-action="new-medical-office"]')?.addEventListener('click', () => {
    state.showCreateMedicalOfficeModal = true;
    renderContent();
  });
  const searchOffices = debounce(async (query) => {
    const response = await api(`/api/medical-offices?limit=100&q=${encodeURIComponent(query)}`);
    state.medicalOffices = response.offices || [];
    const table = document.querySelector('#medicalOfficeTable');
    if (table) table.innerHTML = renderMedicalOfficeRows(filteredMedicalOffices());
    bindMedicalOfficeRows();
  }, 250);
  document.querySelector('#medicalOfficeSearch')?.addEventListener('input', (event) => {
    state.medicalOfficeSearch = event.currentTarget.value;
    searchOffices(state.medicalOfficeSearch);
  });
  document.querySelector('[data-action="back-to-medical-offices"]')?.addEventListener('click', () => {
    state.selectedMedicalOfficeId = '';
    state.medicalOfficeCaseSearch = '';
    state.medicalOfficeCasePage = 1;
    renderContent();
  });
  document.querySelector('[data-action="go-doctor-management"]')?.addEventListener('click', () => {
    state.view = 'doctor-management';
    state.selectedMedicalOfficeId = '';
    state.doctorManagementSearch = '';
    state.selectedManagedDoctorId = '';
    renderContent();
  });
  document.querySelector('#medicalOfficeCaseSearch')?.addEventListener('input', (event) => {
    state.medicalOfficeCaseSearch = event.currentTarget.value;
    state.medicalOfficeCasePage = 1;
    renderContent();
  });
  document.querySelector('#officeAssignClinicianForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const clinicianId = data.get('clinicianId');
    const office = state.medicalOffices.find((item) => item.id === form.dataset.officeId);
    if (!office || !clinicianId) return;
    await updateOfficeClinicianAssignments(office, [...new Set([...(office.assignedClinicianIds || []), clinicianId])]);
  });
  document.querySelectorAll('[data-remove-office-clinician]').forEach((button) => {
    button.addEventListener('click', async () => {
      const office = state.medicalOffices.find((item) => item.id === button.dataset.officeId);
      if (!office) return;
      await updateOfficeClinicianAssignments(
        office,
        (office.assignedClinicianIds || []).filter((id) => id !== button.dataset.removeOfficeClinician)
      );
    });
  });
  document.querySelector('[data-action="office-case-prev-page"]')?.addEventListener('click', () => {
    state.medicalOfficeCasePage = Math.max(1, state.medicalOfficeCasePage - 1);
    renderContent();
  });
  document.querySelector('[data-action="office-case-next-page"]')?.addEventListener('click', () => {
    state.medicalOfficeCasePage += 1;
    renderContent();
  });
  bindMedicalOfficeRows();
  bindDoctorManagementRows();
  bindMedicalOfficeModal();
  bindDetailModal();
}

async function updateOfficeClinicianAssignments(office, assignedClinicianIds) {
  await api(`/api/medical-offices/${encodeURIComponent(office.id)}`, {
    method: 'PATCH',
    body: {
      name: office.name,
      phone: office.phone,
      email: office.email,
      address: office.address,
      defaultMedicalFee: office.defaultMedicalFee,
      notes: office.notes,
      assignedClinicianIds
    }
  });
  await loadMedicalOfficeData();
  renderContent();
}

async function loadMedicalOfficeData() {
  const [officeResponse, clinicianResponse, casesResponse] = await Promise.all([
    api('/api/medical-offices?limit=250'),
    api('/api/setup/clinicians?limit=250'),
    api('/api/cases?limit=250')
  ]);
  state.medicalOffices = officeResponse.offices || [];
  state.clinicians = clinicianResponse.clinicians || [];
  state.cases = casesResponse.cases || [];
  const table = document.querySelector('#medicalOfficeTable');
  if (table) table.innerHTML = renderMedicalOfficeRows(filteredMedicalOffices());
  bindMedicalOfficeRows();
}

function filteredMedicalOffices() {
  const query = state.medicalOfficeSearch.trim().toLowerCase();
  return (state.medicalOffices || []).filter((office) => office.active !== false).filter((office) => !query || [
    office.name,
    office.address,
    office.phone,
    office.email
  ].join(' ').toLowerCase().includes(query));
}

function selectedMedicalOffice() {
  return (state.medicalOffices || []).find((office) => office.id === state.selectedMedicalOfficeId) || null;
}

function officeClinicians(office) {
  const ids = new Set(office?.assignedClinicianIds || []);
  return (state.clinicians || []).filter((doctor) => ids.has(doctor.id));
}

function officeDoctors(office) {
  return officeClinicians(office).filter(isDoctorOfficeUser);
}

function medicalOfficeUserType(user) {
  return user?.medicalProfile?.officeUserType || 'doctor';
}

function isDoctorOfficeUser(user) {
  return medicalOfficeUserType(user) === 'doctor';
}

function medicalOfficeUserTypeLabel(user) {
  return isDoctorOfficeUser(user) ? 'Doctor' : 'Clinician / support';
}

function officeForCase(medicalCase) {
  return (state.medicalOffices || []).find((office) => (office.assignedClinicianIds || []).includes(medicalCase.assignedClinicianId)) || null;
}

function officeCases(office) {
  const clinicianIds = new Set(office?.assignedClinicianIds || []);
  return (state.cases || []).filter((medicalCase) => clinicianIds.has(medicalCase.assignedClinicianId));
}

function filteredOfficeCases(office) {
  const query = state.medicalOfficeCaseSearch.trim().toLowerCase();
  const selectedCases = officeCases(office).map((medicalCase) => ({ medicalCase, isRelatedOffice: false }));
  if (!query) return selectedCases;
  const matches = (state.cases || [])
    .filter((medicalCase) => [
      medicalCase.id,
      medicalCase.patientName,
      medicalCase.patientEmail,
      medicalCase.employeeId,
      medicalCase.assignedClinicianName,
      caseStatusLabels[medicalCase.status]
    ].join(' ').toLowerCase().includes(query))
    .map((medicalCase) => ({
      medicalCase,
      isRelatedOffice: !officeCases(office).some((item) => item.id === medicalCase.id)
    }));
  const seen = new Set();
  return [...selectedCases.filter((item) => [
    item.medicalCase.id,
    item.medicalCase.patientName,
    item.medicalCase.patientEmail,
    item.medicalCase.employeeId,
    item.medicalCase.assignedClinicianName,
    caseStatusLabels[item.medicalCase.status]
  ].join(' ').toLowerCase().includes(query)), ...matches]
    .filter((item) => {
      if (seen.has(item.medicalCase.id)) return false;
      seen.add(item.medicalCase.id);
      return true;
    });
}

function renderMedicalOfficeRows(offices = filteredMedicalOffices()) {
  if (!offices.length) return '<div class="empty">No medical offices found.</div>';
  return `
    <div class="user-row user-row-head medical-office-row">
      <strong>Medical office</strong>
      <strong>Doctors / clinicians</strong>
      <strong>Action</strong>
    </div>
    ${offices.map((office) => `
      <div class="user-row medical-office-row" data-office-id="${escapeHtml(office.id)}">
        <div>
          <strong>${escapeHtml(office.name)}</strong>
          <div class="muted">${escapeHtml([office.address, office.phone, office.email].filter(Boolean).join(' | ') || 'No contact details recorded')}</div>
        </div>
        <span>${officeClinicians(office).length}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-select-office="${escapeHtml(office.id)}">View</button>
          <button class="text-btn" type="button" data-edit-office="${escapeHtml(office.id)}">Edit</button>
          <button class="text-btn danger-text" type="button" data-delete-office="${escapeHtml(office.id)}" ${office.active === false ? 'disabled' : ''}>Delete</button>
        </div>
      </div>
    `).join('')}
  `;
}

function bindMedicalOfficeRows() {
  document.querySelectorAll('[data-select-office]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedMedicalOfficeId = button.dataset.selectOffice;
      state.medicalOfficeCaseSearch = '';
      state.medicalOfficeCasePage = 1;
      renderContent();
    });
  });
  document.querySelectorAll('[data-edit-office]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingMedicalOfficeId = button.dataset.editOffice;
      renderContent();
    });
  });
  document.querySelectorAll('[data-delete-office]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Deactivate this medical office?')) return;
      await api(`/api/medical-offices/${encodeURIComponent(button.dataset.deleteOffice)}`, {
        method: 'PATCH',
        body: { active: false }
      });
      await loadMedicalOfficeData();
    });
  });
}

function renderMedicalOfficeDashboard(office) {
  const clinicians = officeClinicians(office);
  const cases = officeCases(office);
  const processed = cases.filter((medicalCase) => ['doctor_submitted', 'review_pending', 'reviewed', 'archived'].includes(medicalCase.status));
  const filtered = filteredOfficeCases(office);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.medicalOfficeCasePage = Math.min(state.medicalOfficeCasePage, pageCount);
  const pageRows = filtered.slice((state.medicalOfficeCasePage - 1) * pageSize, state.medicalOfficeCasePage * pageSize);
  return `
    <div class="panel-header patient-detail-header">
      <div>
        <button class="text-btn patient-back-btn" type="button" data-action="back-to-medical-offices">Back to offices</button>
        <h2>${escapeHtml(office.name)}</h2>
        <div class="muted">${escapeHtml([office.address, office.phone, office.email].filter(Boolean).join(' | ') || 'No contact details recorded')}</div>
      </div>
      <div class="header-actions">
        <button class="secondary-btn compact-primary" type="button" data-action="go-doctor-management">Doctor management</button>
        <button class="secondary-btn compact-primary" type="button" data-edit-office="${escapeHtml(office.id)}">Edit office</button>
      </div>
    </div>
    <div class="panel-body form-stack">
      <div class="dashboard-metric-grid">
        ${dashboardMetric('Doctors', clinicians.filter(isDoctorOfficeUser).length, 'M')}
        ${dashboardMetric('Clinicians', clinicians.filter((user) => !isDoctorOfficeUser(user)).length, 'S')}
        ${dashboardMetric('Assigned cases', cases.length, 'C')}
        ${dashboardMetric('Processed cases', processed.length, 'Q')}
        ${dashboardMetric('Open cases', cases.filter((item) => !['reviewed', 'archived', 'withdrawn', 'canceled_by_doctor'].includes(item.status)).length, 'D')}
        ${dashboardMetric('Office fee', office.defaultMedicalFee ? formatCurrency(office.defaultMedicalFee) : 'Not set', '$')}
      </div>
      ${renderOfficeClinicianPanel(office)}
      <section class="patient-medical-history">
        <div class="section-heading-row">
          <h3>Medical cases</h3>
          <span>${filtered.length} shown</span>
        </div>
        <div class="field inline-filter">
          <label class="sr-only" for="medicalOfficeCaseSearch">Search office cases</label>
          <input id="medicalOfficeCaseSearch" type="search" value="${escapeHtml(state.medicalOfficeCaseSearch)}" placeholder="Search cases assigned to this office">
        </div>
        <div class="user-table office-case-table">
          ${renderOfficeCaseRows(pageRows)}
        </div>
        <div class="pagination-bar">
          <button class="secondary-btn" type="button" data-action="office-case-prev-page" ${state.medicalOfficeCasePage <= 1 ? 'disabled' : ''}>Previous</button>
          <span>Page ${state.medicalOfficeCasePage} of ${pageCount}</span>
          <button class="secondary-btn" type="button" data-action="office-case-next-page" ${state.medicalOfficeCasePage >= pageCount ? 'disabled' : ''}>Next</button>
        </div>
      </section>
    </div>
  `;
}

function renderOfficeClinicianPanel(office) {
  const assigned = officeClinicians(office);
  const assignedIds = new Set(office.assignedClinicianIds || []);
  const available = (state.clinicians || []).filter((doctor) => !assignedIds.has(doctor.id));
  return `
    <section class="office-assignment-panel">
      <div class="section-heading-row">
        <h3>Medical office users</h3>
        <span>${assigned.length} assigned</span>
      </div>
      <form id="officeAssignClinicianForm" class="office-assign-form" data-office-id="${escapeHtml(office.id)}">
        <div class="field">
          <label for="officeClinicianSelect">Assign office user</label>
          <select id="officeClinicianSelect" name="clinicianId" ${available.length ? '' : 'disabled'}>
            <option value="">${available.length ? 'Select office user' : 'No unassigned office users available'}</option>
            ${available.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.displayName)} - ${escapeHtml(medicalOfficeUserTypeLabel(doctor))} - ${escapeHtml(doctor.email)}</option>`).join('')}
          </select>
        </div>
        <button class="secondary-btn" type="submit" ${available.length ? '' : 'disabled'}>Assign</button>
      </form>
      <div class="office-clinician-list">
        ${assigned.length ? assigned.map((doctor) => `
          <div class="office-clinician-row">
            <div>
              <strong>${escapeHtml(doctor.displayName)}</strong>
              <span>${escapeHtml(medicalOfficeUserTypeLabel(doctor))} | ${escapeHtml(doctor.email)}</span>
            </div>
            <div class="table-actions">
              ${isDoctorOfficeUser(doctor) ? `<button class="text-btn" type="button" data-select-managed-doctor="${escapeHtml(doctor.id)}">View doctor</button>` : ''}
              <button class="text-btn danger-text" type="button" data-remove-office-clinician="${escapeHtml(doctor.id)}" data-office-id="${escapeHtml(office.id)}">Remove</button>
            </div>
          </div>
        `).join('') : '<div class="empty">No doctors or clinicians assigned.</div>'}
      </div>
    </section>
  `;
}

function renderOfficeCaseRows(rows) {
  if (!rows.length) return '<div class="empty">No medical cases found.</div>';
  return `
    <div class="user-row user-row-head office-case-row">
      <strong>Case</strong>
      <strong>Status</strong>
      <strong>Medical office</strong>
      <strong>Action</strong>
    </div>
    ${rows.map(({ medicalCase, isRelatedOffice }) => {
      const relatedOffice = officeForCase(medicalCase);
      return `
        <div class="user-row office-case-row">
          <div>
            <strong>${escapeHtml(medicalCase.patientName || medicalCase.id)}</strong>
            <div class="muted">${escapeHtml(medicalCase.id)} | ${escapeHtml(formatDateTime(medicalCase.createdAt))}</div>
          </div>
          <span>${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status || 'Not recorded')}</span>
          <span class="${isRelatedOffice ? 'muted' : ''}">${escapeHtml(isRelatedOffice ? `Other office: ${relatedOffice?.name || medicalCase.assignedClinicianName || 'Unassigned'}` : relatedOffice?.name || medicalCase.assignedClinicianName || 'Unassigned')}</span>
          <div class="table-actions">
            ${isRelatedOffice && relatedOffice ? `<button class="text-btn" type="button" data-select-office="${escapeHtml(relatedOffice.id)}">Go to office</button>` : ''}
            <button class="text-btn" type="button" data-open-office-case="${escapeHtml(medicalCase.id)}">Open</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function renderMedicalOfficeDetailPanel(office) {
  return `
    <form id="medicalOfficeDetailForm" class="form-stack" ${office.id ? `data-office-id="${escapeHtml(office.id)}"` : ''}>
      <div class="grid-3">
        ${field('name', 'Office name', 'text', true, office.name || '')}
        ${field('phone', 'Office phone', 'tel', false, office.phone || '')}
        ${field('email', 'Office email', 'email', false, office.email || '')}
      </div>
      <div class="grid-3">
        ${field('defaultMedicalFee', 'Office medical fee', 'number', false, office.defaultMedicalFee || '')}
      </div>
      ${textarea('address', 'Address', office.address || '')}
      ${textarea('notes', 'Notes', office.notes || '')}
      <button class="primary-btn" type="submit">Save medical office</button>
    </form>
  `;
}

function renderMedicalOfficeModal() {
  const office = state.editingMedicalOfficeId
    ? state.medicalOffices.find((item) => item.id === state.editingMedicalOfficeId)
    : null;
  if (!office && !state.showCreateMedicalOfficeModal) return '';
  return `
    <div class="modal-backdrop" data-action="close-medical-office-modal">
      <section class="modal-content managed-user-modal" role="dialog" aria-modal="true" aria-label="${office ? 'Edit medical office' : 'Create medical office'}">
        <div class="managed-modal-header">
          <div class="managed-modal-identity">
            <span class="avatar is-large" aria-hidden="true">M</span>
            <div>
              <h2>${office ? 'Edit medical office' : 'New medical office'}</h2>
              <span>${office ? escapeHtml(office.name) : 'Create a medical office facility.'}</span>
            </div>
          </div>
          <button class="icon-close-btn" type="button" data-action="close-medical-office-modal" aria-label="Close">&times;</button>
        </div>
        <div class="managed-modal-body">
          ${renderMedicalOfficeDetailPanel(office || {})}
        </div>
      </section>
    </div>
  `;
}

function bindMedicalOfficeModal() {
  document.querySelectorAll('[data-action="close-medical-office-modal"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target !== element && element.classList.contains('modal-backdrop')) return;
      state.showCreateMedicalOfficeModal = false;
      state.editingMedicalOfficeId = '';
      renderContent();
    });
  });
  document.querySelectorAll('[data-open-office-case]').forEach((button) => {
    button.addEventListener('click', () => openDetailModal('case', button.dataset.openOfficeCase));
  });
  document.querySelector('#medicalOfficeDetailForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const isEdit = Boolean(form.dataset.officeId);
    await api(isEdit ? `/api/medical-offices/${encodeURIComponent(form.dataset.officeId)}` : '/api/medical-offices', {
      method: isEdit ? 'PATCH' : 'POST',
      body: {
        name: data.get('name'),
        phone: data.get('phone'),
        email: data.get('email'),
        defaultMedicalFee: data.get('defaultMedicalFee'),
        address: data.get('address'),
        notes: data.get('notes')
      }
    });
    state.showCreateMedicalOfficeModal = false;
    state.editingMedicalOfficeId = '';
    await loadMedicalOfficeData();
    renderContent();
  });
}

function renderReportManagement() {
  const rows = filteredReportCases();
  const paymentCases = payableReportCases();
  const paymentRows = doctorPaymentReportRows(paymentCases);
  const totals = paymentReportTotals(paymentRows);
  const pendingRows = pendingReportRows(rows);
  const turnaroundRows = doctorTurnaroundRows(paymentCases);
  const usageStats = reportUsageStats(rows);
  state.reportChartConfigs = [];
  return `
    <div class="admin-grid">
      <section class="panel report-filter-panel">
        <div class="panel-header">
          <div>
            <h2>Report Management</h2>
            <div class="muted">Choose one report at a time, then refine it with the filters below.</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" type="button" data-action="export-payment-report">Export CSV</button>
            <button class="secondary-btn compact-primary" type="button" data-action="refresh-report-management">Refresh</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          ${renderReportFilterShell()}
        </div>
      </section>

      <section class="panel report-directory-panel">
        <div class="panel-body">
          ${renderReportNavigation(rows, paymentRows, pendingRows, turnaroundRows, usageStats)}
        </div>
      </section>

      <section id="reportContent">
        ${renderActiveReportSection(rows, paymentRows, totals, pendingRows, turnaroundRows, usageStats)}
      </section>
    </div>
    ${renderDetailModal()}
  `;
}

function bindReportManagement() {
  if (!state.reportManagementLoaded) loadReportManagementData();
  document.querySelector('[data-action="refresh-report-management"]')?.addEventListener('click', loadReportManagementData);
  document.querySelector('[data-action="export-payment-report"]')?.addEventListener('click', exportPaymentReportCsv);
  document.querySelector('#reportFilterForm')?.addEventListener('input', updateReportFilters);
  document.querySelector('#reportFilterForm')?.addEventListener('change', updateReportFilters);
  document.querySelectorAll('[data-report-filter-option]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      state.reportVisibleFilters = [...document.querySelectorAll('[data-report-filter-option]:checked')].map((item) => item.value);
      normalizeReportFiltersForVisible();
      renderContent();
    });
  });
  bindReportRows();
  bindDetailModal();
  initializeReportCharts();
}

function updateReportFilters(event) {
  const form = event.currentTarget;
  const data = new FormData(form);
  const visible = new Set(state.reportVisibleFilters);
  state.reportFilters = {
    query: visible.has('query') ? data.get('query') || '' : '',
    startDate: visible.has('date') ? data.get('startDate') || '' : '',
    endDate: visible.has('date') ? data.get('endDate') || '' : '',
    stage: visible.has('stage') ? data.get('stage') || '' : '',
    doctorQuery: visible.has('doctor') ? data.get('doctorQuery') || '' : '',
    medicalOfficeQuery: visible.has('office') ? data.get('medicalOfficeQuery') || '' : '',
    paymentStatus: visible.has('paymentStatus') ? data.get('paymentStatus') || '' : ''
  };
  state.reportDrilldown = null;
  const rows = filteredReportCases();
  const paymentCases = payableReportCases();
  const paymentRows = doctorPaymentReportRows(paymentCases);
  const totals = paymentReportTotals(paymentRows);
  const pendingRows = pendingReportRows(rows);
  const turnaroundRows = doctorTurnaroundRows(paymentCases);
  const usageStats = reportUsageStats(rows);
  const content = document.querySelector('#reportContent');
  const directory = document.querySelector('.report-directory-panel .panel-body');
  state.reportChartConfigs = [];
  if (directory) directory.innerHTML = renderReportNavigation(rows, paymentRows, pendingRows, turnaroundRows, usageStats);
  if (content) content.innerHTML = renderActiveReportSection(rows, paymentRows, totals, pendingRows, turnaroundRows, usageStats);
  bindReportRows();
  initializeReportCharts();
}

function normalizeReportFiltersForVisible() {
  const visible = new Set(state.reportVisibleFilters);
  state.reportFilters = {
    ...state.reportFilters,
    query: visible.has('query') ? state.reportFilters.query : '',
    startDate: visible.has('date') ? state.reportFilters.startDate : '',
    endDate: visible.has('date') ? state.reportFilters.endDate : '',
    stage: visible.has('stage') ? state.reportFilters.stage : '',
    doctorQuery: visible.has('doctor') ? state.reportFilters.doctorQuery : '',
    medicalOfficeQuery: visible.has('office') ? state.reportFilters.medicalOfficeQuery : '',
    paymentStatus: visible.has('paymentStatus') ? state.reportFilters.paymentStatus : ''
  };
}

function renderReportFilterShell() {
  const options = [
    ['query', 'Search'],
    ['date', 'Date range'],
    ['stage', 'Case stage'],
    ['doctor', 'Doctor'],
    ['office', 'Medical office'],
    ['paymentStatus', 'Billing']
  ];
  return `
    <div class="report-filter-shell">
      <details class="report-filter-picker">
        <summary>Filters</summary>
        <div>
          ${options.map(([key, label]) => `
            <label>
              <input type="checkbox" value="${escapeHtml(key)}" data-report-filter-option ${state.reportVisibleFilters.includes(key) ? 'checked' : ''}>
              <span>${escapeHtml(label)}</span>
            </label>
          `).join('')}
        </div>
      </details>
      <form id="reportFilterForm" class="report-filter-card">
        ${renderReportFilterControls()}
      </form>
    </div>
  `;
}

function renderReportFilterControls() {
  const visible = new Set(state.reportVisibleFilters);
  const controls = [];
  if (visible.has('query')) {
    controls.push(`
      <div class="field">
        <label for="reportQuery">Search</label>
        <input id="reportQuery" name="query" type="search" value="${escapeHtml(state.reportFilters.query)}" placeholder="Patient, staff ID, case ID">
      </div>
    `);
  }
  if (visible.has('date')) {
    controls.push(`
      <div class="field">
        <label for="reportStartDate">Start</label>
        <input id="reportStartDate" name="startDate" type="date" value="${escapeHtml(state.reportFilters.startDate)}">
      </div>
      <div class="field">
        <label for="reportEndDate">End</label>
        <input id="reportEndDate" name="endDate" type="date" value="${escapeHtml(state.reportFilters.endDate)}">
      </div>
    `);
  }
  if (visible.has('stage')) {
    controls.push(`
      <div class="field">
        <label for="reportStage">Stage</label>
        <select id="reportStage" name="stage">
          <option value="">All stages</option>
          ${Object.entries(caseStatusLabels).map(([status, label]) => `<option value="${escapeHtml(status)}" ${state.reportFilters.stage === status ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select>
      </div>
    `);
  }
  if (visible.has('doctor')) {
    controls.push(`
      <div class="field">
        <label for="reportDoctorQuery">Doctor</label>
        <input id="reportDoctorQuery" name="doctorQuery" type="search" value="${escapeHtml(state.reportFilters.doctorQuery)}" list="reportDoctorSuggestions" placeholder="Type doctor name or email">
        <datalist id="reportDoctorSuggestions">
          ${managedDoctors().slice(0, 40).map((doctor) => `<option value="${escapeHtml(doctor.displayName)}">${escapeHtml(doctor.email || '')}</option>`).join('')}
        </datalist>
      </div>
    `);
  }
  if (visible.has('office')) {
    controls.push(`
      <div class="field">
        <label for="reportOfficeQuery">Medical office</label>
        <input id="reportOfficeQuery" name="medicalOfficeQuery" type="search" value="${escapeHtml(state.reportFilters.medicalOfficeQuery)}" list="reportOfficeSuggestions" placeholder="Type office name or address">
        <datalist id="reportOfficeSuggestions">
          ${(state.medicalOffices || []).filter((office) => office.active !== false).slice(0, 40).map((office) => `<option value="${escapeHtml(office.name)}">${escapeHtml(office.address || '')}</option>`).join('')}
        </datalist>
      </div>
    `);
  }
  if (visible.has('paymentStatus')) {
    controls.push(`
      <div class="field">
        <label for="reportPayment">Billing</label>
        <select id="reportPayment" name="paymentStatus">
          <option value="">All billing</option>
          ${['paid', 'unpaid', 'not_payable'].map((status) => `<option value="${status}" ${state.reportFilters.paymentStatus === status ? 'selected' : ''}>${escapeHtml(paymentStatusLabel(status))}</option>`).join('')}
        </select>
      </div>
    `);
  }
  return controls.join('') || '<div class="empty">Choose filters to refine this report.</div>';
}

function bindReportRows() {
  document.querySelectorAll('[data-report-section]').forEach((button) => {
    button.addEventListener('click', () => {
      state.reportSection = button.dataset.reportSection;
      state.reportDrilldown = null;
      renderContent();
    });
  });
  document.querySelectorAll('[data-open-report-case]').forEach((button) => {
    button.addEventListener('click', () => openDetailModal('case', button.dataset.openReportCase));
  });
  document.querySelectorAll('[data-report-drilldown]').forEach((button) => {
    button.addEventListener('click', () => {
      state.reportDrilldown = button.dataset.reportDrilldown;
      const panel = document.querySelector('#reportDrilldownPanel');
      if (panel) panel.innerHTML = renderReportDrilldown();
      bindReportRows();
    });
  });
  document.querySelector('[data-action="close-report-drilldown"]')?.addEventListener('click', () => {
    state.reportDrilldown = null;
    const panel = document.querySelector('#reportDrilldownPanel');
    if (panel) panel.innerHTML = renderReportDrilldown();
  });
}

async function loadReportManagementData() {
  const response = await api('/api/reports/management');
  state.clinicians = response.clinicians || [];
  state.medicalOffices = response.offices || [];
  state.cases = response.cases || [];
  state.patientReportStats = response.patientStats || { total: 0, linked: 0 };
  state.reportUserStats = response.userStats || { doctors: 0, clinicians: 0, offices: 0 };
  state.monthlyReport = [];
  state.reportManagementLoaded = true;
  if (state.view === 'report-management') renderContent();
}

function filteredReportCases() {
  const query = state.reportFilters.query.trim().toLowerCase();
  const doctorQuery = state.reportFilters.doctorQuery.trim().toLowerCase();
  const officeQuery = state.reportFilters.medicalOfficeQuery.trim().toLowerCase();
  return (state.cases || []).filter((medicalCase) => {
    const office = officeForCase(medicalCase);
    const doctor = doctorForCase(medicalCase);
    if (state.reportFilters.stage && medicalCase.status !== state.reportFilters.stage) return false;
    if (doctorQuery && ![
      doctor?.displayName,
      doctor?.email,
      doctor?.medicalProfile?.clinicianName,
      doctor?.medicalProfile?.registrationNumber,
      medicalCase.assignedClinicianName
    ].join(' ').toLowerCase().includes(doctorQuery)) return false;
    if (officeQuery && ![
      office?.name,
      office?.address,
      office?.phone,
      office?.email,
      medicalCase.assignedClinicianName
    ].join(' ').toLowerCase().includes(officeQuery)) return false;
    if (state.reportFilters.paymentStatus && doctorPaymentStatus(medicalCase) !== state.reportFilters.paymentStatus) return false;
    if (!dateInReportRange(reportCaseDate(medicalCase))) return false;
    if (!query) return true;
    return [
      medicalCase.patientName,
      medicalCase.employeeId,
      medicalCase.position,
      medicalCase.assignedClinicianName,
      office?.name,
      medicalCase.id
    ].join(' ').toLowerCase().includes(query);
  });
}

function payableReportCases() {
  return filteredReportCases().filter((medicalCase) => isPayableCaseStatus(medicalCase.status));
}

function isPayableCaseStatus(status) {
  return ['doctor_submitted', 'review_pending', 'reviewed', 'archived'].includes(status);
}

function reportCaseDate(medicalCase) {
  if (!medicalCase) return '';
  if (['reviewed', 'archived'].includes(medicalCase.status) && medicalCase.updatedAt) return medicalCase.updatedAt;
  return medicalCase.submittedAt || medicalCase.completedAt || medicalCase.updatedAt || medicalCase.createdAt || '';
}

function dateInReportRange(value) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  if (state.reportFilters.startDate) {
    const start = new Date(`${state.reportFilters.startDate}T00:00:00`);
    if (date < start) return false;
  }
  if (state.reportFilters.endDate) {
    const end = new Date(`${state.reportFilters.endDate}T23:59:59`);
    if (date > end) return false;
  }
  return true;
}

function doctorPaymentReportRows(cases = payableReportCases()) {
  const rows = new Map();
  for (const medicalCase of cases) {
    const doctor = doctorForCase(medicalCase);
    const office = officeForCase(medicalCase);
    const key = doctor?.id || `office:${office?.id || 'unassigned'}`;
    const row = rows.get(key) || {
      key,
      doctorId: doctor?.id || '',
      doctorName: doctor?.displayName || medicalCase.assignedClinicianName || 'Unassigned doctor',
      officeId: office?.id || '',
      officeName: office?.name || 'Unassigned office',
      rate: reportCaseRate(medicalCase),
      processed: 0,
      paid: 0,
      unpaid: 0,
      paidTotal: 0,
      unpaidTotal: 0,
      totalPayable: 0,
      cases: []
    };
    const amount = reportCaseAmount(medicalCase);
    const paymentStatus = doctorPaymentStatus(medicalCase);
    row.processed += 1;
    row.rate = row.rate || reportCaseRate(medicalCase);
    row.totalPayable += amount;
    if (paymentStatus === 'paid') {
      row.paid += 1;
      row.paidTotal += amount;
    } else if (paymentStatus === 'unpaid') {
      row.unpaid += 1;
      row.unpaidTotal += amount;
    }
    row.cases.push(medicalCase);
    rows.set(key, row);
  }
  return [...rows.values()].sort((left, right) => right.totalPayable - left.totalPayable || left.doctorName.localeCompare(right.doctorName));
}

function paymentReportTotals(rows) {
  return rows.reduce((totals, row) => ({
    processed: totals.processed + row.processed,
    payable: totals.payable + row.totalPayable,
    paid: totals.paid + row.paidTotal,
    unpaid: totals.unpaid + row.unpaidTotal,
    doctors: totals.doctors + 1
  }), { processed: 0, payable: 0, paid: 0, unpaid: 0, doctors: 0 });
}

function doctorForCase(medicalCase) {
  return (state.clinicians || []).find((doctor) => doctor.id === medicalCase.assignedClinicianId) || null;
}

function reportCaseRate(medicalCase) {
  const doctor = doctorForCase(medicalCase);
  const office = officeForCase(medicalCase);
  return Number(doctor?.medicalProfile?.defaultMedicalFee || office?.defaultMedicalFee || medicalCase.payableAmount || 0);
}

function reportCaseAmount(medicalCase) {
  return Number(medicalCase.payableAmount || reportCaseRate(medicalCase) || 0);
}

function renderReportNavigation(rows, paymentRows, pendingRows, turnaroundRows, usageStats) {
  const reports = [
    ['overview', 'Overview', 'Charts and summary', rows.length],
    ['payment', 'Payment report', 'Doctor and office payable totals', paymentRows.length],
    ['cases', 'Case details', 'Filtered medical case listing', rows.length],
    ['pending', 'Pending medicals', 'Open cases by responsible party', pendingRows.length],
    ['turnaround', 'Turnaround', 'Doctor processing time', turnaroundRows.length],
    ['usage', 'Usage', 'System activity and volume', usageStats.totalCases]
  ];
  return `
    <div class="report-directory">
      ${reports.map(([key, title, description, count]) => `
        <button class="report-directory-card ${state.reportSection === key ? 'is-active' : ''}" type="button" data-report-section="${escapeHtml(key)}">
          <span>
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(description)}</small>
          </span>
          <em>${escapeHtml(count)}</em>
        </button>
      `).join('')}
    </div>
  `;
}

function renderActiveReportSection(rows, paymentRows, totals, pendingRows, turnaroundRows, usageStats) {
  if (state.reportSection === 'payment') {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Doctor / Medical Office Payment Report</h2>
            <div class="muted">${paymentRows.length} payable groups, ${totals.processed} processed medicals.</div>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="report-summary-cards is-compact">
            ${reportMetric('Medicals processed', totals.processed)}
            ${reportMetric('Total payable', formatCurrency(totals.payable))}
            ${reportMetric('Total paid', formatCurrency(totals.paid))}
            ${reportMetric('Total unpaid', formatCurrency(totals.unpaid))}
          </div>
          <div class="user-table report-payment-table" id="reportPaymentTable">${renderPaymentReportRows(paymentRows)}</div>
          <div id="reportDrilldownPanel">${renderReportDrilldown()}</div>
        </div>
      </section>
    `;
  }
  if (state.reportSection === 'cases') {
    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Case Detail Report</h2>
          <div class="muted">${rows.length} cases match the current filters.</div>
        </div>
        <div class="panel-body">
          <div class="user-table report-case-table" id="reportCaseTable">${renderReportCaseRows(rows)}</div>
        </div>
      </section>
    `;
  }
  if (state.reportSection === 'pending') {
    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Pending Medicals Report</h2>
          <div class="muted">${pendingRows.length} open items.</div>
        </div>
        <div class="panel-body">
          <div class="user-table report-pending-table" id="reportPendingTable">${renderPendingReportRows(pendingRows)}</div>
        </div>
      </section>
    `;
  }
  if (state.reportSection === 'turnaround') {
    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Doctor Turnaround Report</h2>
          <div class="muted">${turnaroundRows.length} doctors have processing data.</div>
        </div>
        <div class="panel-body">
          <div class="user-table report-turnaround-table" id="reportTurnaroundTable">${renderTurnaroundRows(turnaroundRows)}</div>
        </div>
      </section>
    `;
  }
  if (state.reportSection === 'usage') {
    return renderUsageReport(usageStats);
  }
  return `
    <section class="report-dashboard" id="reportDashboard">
      ${renderReportDashboard(rows, paymentRows, totals, pendingRows, turnaroundRows)}
    </section>
  `;
}

function renderReportDashboard(rows, paymentRows, totals, pendingRows, turnaroundRows) {
  const statusCounts = countBy(rows, 'status');
  return `
    <div class="report-summary-cards">
      ${reportMetric('Medicals processed', totals.processed)}
      ${reportMetric('Total payable', formatCurrency(totals.payable))}
      ${reportMetric('Total paid', formatCurrency(totals.paid))}
      ${reportMetric('Total unpaid', formatCurrency(totals.unpaid))}
      ${reportMetric('Doctors included', totals.doctors)}
    </div>
    <div class="report-chart-grid">
      <div class="panel report-chart-card">
        <div class="panel-header"><h2>Payment status</h2></div>
        <div class="panel-body">${renderDonutChart([
          ['Paid', totals.paid, '#198754'],
          ['Unpaid', totals.unpaid, '#ffc107']
        ])}</div>
      </div>
      <div class="panel report-chart-card">
        <div class="panel-header"><h2>Cases by stage</h2></div>
        <div class="panel-body">${renderBarChart(Object.entries(caseStatusLabels).map(([status, label]) => [label, statusCounts[status] || 0]))}</div>
      </div>
      <div class="panel report-chart-card">
        <div class="panel-header"><h2>Open workload</h2></div>
        <div class="panel-body">${renderBarChart([
          ['Pending', pendingRows.length],
          ['Doctors with turnaround', turnaroundRows.length],
          ['Payment rows', paymentRows.length]
        ])}</div>
      </div>
    </div>
  `;
}

function renderDonutChart(items) {
  const total = items.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const paid = items[0]?.[1] || 0;
  const percent = total ? Math.round((paid / total) * 100) : 0;
  const chart = registerReportChart({
    type: 'doughnut',
    data: {
      labels: items.map(([label]) => label),
      datasets: [{
        data: items.map(([, value]) => Number(value || 0)),
        backgroundColor: items.map(([, , color]) => color),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`
          }
        }
      },
      maintainAspectRatio: false,
      responsive: true
    }
  }, renderDonutFallback(items, percent));
  return `
    <div class="report-donut-wrap">
      ${chart}
      <div class="report-legend">
        ${items.map(([label, value, color]) => `<span><i style="background:${escapeHtml(color)}"></i>${escapeHtml(label)} ${escapeHtml(formatCurrency(value))}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderBarChart(items) {
  const max = Math.max(1, ...items.map(([, value]) => Number(value || 0)));
  const filtered = items.filter(([, value]) => Number(value || 0) > 0);
  if (!filtered.length) return '<div class="empty">No chart data for the current filters.</div>';
  return registerReportChart({
    type: 'bar',
    data: {
      labels: filtered.map(([label]) => label),
      datasets: [{
        data: filtered.map(([, value]) => Number(value || 0)),
        backgroundColor: chartPalette(filtered.length),
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 26
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false }
      },
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: chartGridColor() },
          ticks: { color: chartMutedColor(), precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { color: chartMutedColor(), font: { size: 11 } }
        }
      }
    }
  }, renderBarFallback(filtered, max));
}

function renderDonutFallback(items, percent) {
  const total = items.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const gradient = total ? `conic-gradient(${items.map(([label, value, color], index) => {
    const start = items.slice(0, index).reduce((sum, [, itemValue]) => sum + (Number(itemValue || 0) / total) * 100, 0);
    const end = start + (Number(value || 0) / total) * 100;
    return `${color} ${start}% ${end}%`;
  }).join(', ')})` : 'conic-gradient(#e9eef6 0 100%)';
  return `
    <div class="report-donut" style="background:${escapeHtml(gradient)}">
      <strong>${escapeHtml(percent)}%</strong>
      <span>paid</span>
    </div>
  `;
}

function renderBarFallback(items, max) {
  return `
    <div class="report-bars">
      ${items.map(([label, value]) => `
        <div class="report-bar-row">
          <span>${escapeHtml(label)}</span>
          <div><i style="width:${Math.max(4, Math.round((Number(value || 0) / max) * 100))}%"></i></div>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function registerReportChart(config, fallbackHtml) {
  const id = `reportChart${state.reportChartConfigs.length + 1}`;
  state.reportChartConfigs.push({ id, config });
  return `
    <div class="report-chart-render" data-report-chart="${escapeHtml(id)}">
      <canvas id="${escapeHtml(id)}" aria-label="Report chart" role="img"></canvas>
      <div class="report-chart-fallback" hidden>${fallbackHtml}</div>
    </div>
  `;
}

function initializeReportCharts() {
  state.reportChartInstances.forEach((chart) => chart?.destroy?.());
  state.reportChartInstances = [];
  const hasChart = typeof window.Chart !== 'undefined';
  state.reportChartConfigs.forEach(({ id, config }) => {
    const canvas = document.querySelector(`#${id}`);
    const wrapper = document.querySelector(`[data-report-chart="${id}"]`);
    const fallback = wrapper?.querySelector('.report-chart-fallback');
    if (!canvas || !wrapper) return;
    if (!hasChart) {
      canvas.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }
    if (fallback) fallback.hidden = true;
    canvas.hidden = false;
    state.reportChartInstances.push(new window.Chart(canvas, config));
  });
}

function chartPalette(count) {
  const colors = ['#0d6efd', '#198754', '#0dcaf0', '#ffc107', '#6f42c1', '#20c997', '#fd7e14', '#dc3545'];
  return Array.from({ length: count }, (_, index) => colors[index % colors.length]);
}

function chartGridColor() {
  return document.documentElement.dataset.theme === 'dark' ? 'rgba(196, 199, 197, 0.18)' : 'rgba(116, 119, 117, 0.18)';
}

function chartMutedColor() {
  return document.documentElement.dataset.theme === 'dark' ? '#c4c7c5' : '#5f6f7c';
}

function renderPaymentReportRows(rows) {
  if (!rows.length) return '<div class="empty">No payable doctor or office totals match the selected filters.</div>';
  return `
    <div class="user-row user-row-head report-payment-row">
      <strong>Doctor / office</strong>
      <strong>Processed</strong>
      <strong>Rate</strong>
      <strong>Total payable</strong>
      <strong>Paid</strong>
      <strong>Unpaid</strong>
      <strong>Action</strong>
    </div>
    ${rows.map((row) => `
      <div class="user-row report-payment-row">
        <div>
          <span>${escapeHtml(row.doctorName)}</span>
          <div class="muted">${escapeHtml(row.officeName)}</div>
        </div>
        <span>${escapeHtml(row.processed)}</span>
        <span>${escapeHtml(row.rate ? formatCurrency(row.rate) : 'N/A')}</span>
        <span>${escapeHtml(formatCurrency(row.totalPayable))}</span>
        <span>${escapeHtml(`${row.paid} | ${formatCurrency(row.paidTotal)}`)}</span>
        <span>${escapeHtml(`${row.unpaid} | ${formatCurrency(row.unpaidTotal)}`)}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-report-drilldown="${escapeHtml(row.key)}">View medicals</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderReportDrilldown() {
  if (!state.reportDrilldown) return '';
  const row = doctorPaymentReportRows(payableReportCases()).find((item) => item.key === state.reportDrilldown);
  if (!row) return '';
  return `
    <section class="report-drilldown">
      <div class="section-heading-row">
        <h3>${escapeHtml(row.doctorName)}</h3>
        <button class="text-btn" type="button" data-action="close-report-drilldown">Close</button>
      </div>
      <div class="user-table report-drilldown-table">
        ${renderReportCaseRows(row.cases, true)}
      </div>
    </section>
  `;
}

function renderReportCaseRows(rows, includeDates = false) {
  if (!rows.length) return '<div class="empty">No cases match the selected report filters.</div>';
  return `
    <div class="user-row user-row-head ${includeDates ? 'report-detail-row' : 'medical-case-row'}">
      <strong>Patient</strong>
      <strong>Stage</strong>
      <strong>Medical office</strong>
      <strong>Billing</strong>
      ${includeDates ? '<strong>Dates</strong>' : ''}
    </div>
    ${rows.map((medicalCase) => `
      <button class="user-row ${includeDates ? 'report-detail-row' : 'medical-case-row'} report-click-row" type="button" data-open-report-case="${escapeHtml(medicalCase.id)}">
        <div>
          <span>${escapeHtml(medicalCase.patientName)}</span>
          <div class="muted">${escapeHtml(medicalCase.employeeId || medicalCase.id)}</div>
        </div>
        <span class="status">${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</span>
        <span>${escapeHtml(officeForCase(medicalCase)?.name || medicalCase.assignedClinicianName || 'Unassigned')}</span>
        <span>
          <span>${escapeHtml(paymentStatusLabel(doctorPaymentStatus(medicalCase)))}</span>
          <div class="muted">${escapeHtml(formatCurrency(reportCaseAmount(medicalCase)))}</div>
        </span>
        ${includeDates ? `<span class="muted">${escapeHtml(`Doctor: ${formatDateTime(medicalCase.submittedAt)} | Report: ${formatDateTime(reportCaseDate(medicalCase))}`)}</span>` : ''}
      </button>
    `).join('')}
  `;
}

function pendingReportRows(rows = filteredReportCases()) {
  return rows.filter((medicalCase) => !['doctor_submitted', 'reviewed', 'archived', 'withdrawn', 'canceled_by_doctor'].includes(medicalCase.status));
}

function renderPendingReportRows(rows) {
  if (!rows.length) return '<div class="empty">No pending medicals match the selected filters.</div>';
  return `
    <div class="user-row user-row-head report-pending-row">
      <strong>Patient</strong>
      <strong>Status</strong>
      <strong>Days pending</strong>
      <strong>Responsible</strong>
      <strong>Office</strong>
    </div>
    ${rows.slice(0, 12).map((medicalCase) => `
      <button class="user-row report-pending-row report-click-row" type="button" data-open-report-case="${escapeHtml(medicalCase.id)}">
        <div><span>${escapeHtml(medicalCase.patientName || medicalCase.id)}</span><div class="muted">${escapeHtml(medicalCase.employeeId || medicalCase.id)}</div></div>
        <span>${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</span>
        <span>${escapeHtml(daysBetween(medicalCase.createdAt, new Date().toISOString()))}</span>
        <span>${escapeHtml(caseStageLabel(medicalCase))}</span>
        <span>${escapeHtml(officeForCase(medicalCase)?.name || medicalCase.assignedClinicianName || 'Unassigned')}</span>
      </button>
    `).join('')}
  `;
}

function doctorTurnaroundRows(cases = payableReportCases()) {
  const rows = new Map();
  for (const medicalCase of cases) {
    if (!medicalCase.assignedAt || !medicalCase.submittedAt) continue;
    const doctor = doctorForCase(medicalCase);
    const office = officeForCase(medicalCase);
    const key = doctor?.id || medicalCase.assignedClinicianId || 'unassigned';
    const hours = hoursBetween(medicalCase.assignedAt, medicalCase.submittedAt);
    if (hours === null) continue;
    const row = rows.get(key) || {
      doctorName: doctor?.displayName || medicalCase.assignedClinicianName || 'Unassigned doctor',
      officeName: office?.name || 'Unassigned office',
      count: 0,
      total: 0,
      min: hours,
      max: hours
    };
    row.count += 1;
    row.total += hours;
    row.min = Math.min(row.min, hours);
    row.max = Math.max(row.max, hours);
    rows.set(key, row);
  }
  return [...rows.values()].map((row) => ({ ...row, average: row.count ? row.total / row.count : 0 })).sort((left, right) => right.count - left.count);
}

function renderTurnaroundRows(rows) {
  if (!rows.length) return '<div class="empty">No turnaround data for the selected filters.</div>';
  return `
    <div class="user-row user-row-head report-turnaround-row">
      <strong>Doctor</strong>
      <strong>Office</strong>
      <strong>Average</strong>
      <strong>Min / max</strong>
      <strong>Count</strong>
    </div>
    ${rows.map((row) => `
      <div class="user-row report-turnaround-row">
        <span>${escapeHtml(row.doctorName)}</span>
        <span>${escapeHtml(row.officeName)}</span>
        <span>${escapeHtml(formatDurationHours(row.average))}</span>
        <span>${escapeHtml(`${formatDurationHours(row.min)} / ${formatDurationHours(row.max)}`)}</span>
        <span>${escapeHtml(row.count)}</span>
      </div>
    `).join('')}
  `;
}

function reportUsageStats(rows = filteredReportCases()) {
  const totalCases = rows.length;
  const completedCases = rows.filter((medicalCase) => ['doctor_submitted', 'review_pending', 'reviewed', 'archived'].includes(medicalCase.status)).length;
  const patientAction = rows.filter((medicalCase) => ['sent_to_patient', 'patient_completed'].includes(medicalCase.status)).length;
  const doctorAction = rows.filter((medicalCase) => ['sent_to_doctor', 'review_pending'].includes(medicalCase.status)).length;
  const hrAction = rows.filter((medicalCase) => medicalCase.status === 'doctor_submitted').length;
  const closedCases = rows.filter((medicalCase) => ['reviewed', 'archived', 'withdrawn', 'canceled_by_doctor'].includes(medicalCase.status)).length;
  const attachmentCount = rows.reduce((total, medicalCase) => total + Number(medicalCase.attachmentsCount || (Array.isArray(medicalCase.attachments) ? medicalCase.attachments.length : 0)), 0);
  const patientStats = state.patientReportStats || {};
  const userStats = state.reportUserStats || {};
  return {
    totalCases,
    completedCases,
    patientAction,
    doctorAction,
    hrAction,
    closedCases,
    attachmentCount,
    patients: Number(patientStats.total || state.candidates.length || 0),
    linkedPatients: Number(patientStats.linked || state.candidates.filter((patient) => patient.linkedUserId || patient.linkedUserEmail).length || 0),
    doctors: Number(userStats.doctors || managedDoctors().length || 0),
    clinicians: Number(userStats.clinicians || (state.clinicians || []).filter((user) => !isDoctorOfficeUser(user)).length || 0),
    offices: Number(userStats.offices || (state.medicalOffices || []).filter((office) => office.active !== false).length || 0),
    casesByMonth: countCasesByMonth(rows)
  };
}

function countCasesByMonth(rows) {
  const counts = new Map();
  for (const medicalCase of rows) {
    const month = monthKeyLocal(medicalCase.createdAt || medicalCase.updatedAt || new Date().toISOString());
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-12);
}

function renderUsageReport(stats) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Usage and Statistics</h2>
          <div class="muted">Operational volume, user setup, case movement, and stored record activity.</div>
        </div>
      </div>
      <div class="panel-body form-stack">
        <div class="report-summary-cards is-compact">
          ${reportMetric('Patients', stats.patients)}
          ${reportMetric('Patient logins', stats.linkedPatients)}
          ${reportMetric('Doctors', stats.doctors)}
          ${reportMetric('Medical offices', stats.offices)}
        </div>
        <div class="report-chart-grid">
          <div class="panel report-chart-card">
            <div class="panel-header"><h2>Workflow load</h2></div>
            <div class="panel-body">${renderBarChart([
              ['Patient action', stats.patientAction],
              ['Medical office', stats.doctorAction],
              ['HR review', stats.hrAction],
              ['Closed', stats.closedCases]
            ])}</div>
          </div>
          <div class="panel report-chart-card">
            <div class="panel-header"><h2>Case creation trend</h2></div>
            <div class="panel-body">${renderBarChart(stats.casesByMonth.map(([month, count]) => [month, count]))}</div>
          </div>
          <div class="panel report-chart-card">
            <div class="panel-header"><h2>Record activity</h2></div>
            <div class="panel-body">${renderBarChart([
              ['Total cases', stats.totalCases],
              ['Processed cases', stats.completedCases],
              ['Attachments', stats.attachmentCount],
              ['Clinicians/support', stats.clinicians]
            ])}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function reportMetric(label, value) {
  return `
    <div class="report-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function countBy(rows, key) {
  return (rows || []).reduce((counts, item) => {
    const value = item[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function hoursBetween(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, (end - start) / 36e5);
}

function daysBetween(startValue, endValue) {
  const hours = hoursBetween(startValue, endValue);
  if (hours === null) return 'N/A';
  return Math.max(0, Math.ceil(hours / 24));
}

function formatDurationHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) return 'N/A';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function exportPaymentReportCsv() {
  const rows = doctorPaymentReportRows(payableReportCases());
  const headers = ['Doctor', 'Medical Office', 'Processed', 'Rate', 'Total Payable', 'Paid Count', 'Paid Total', 'Unpaid Count', 'Unpaid Total', 'Date Range'];
  const dateRange = `${state.reportFilters.startDate || 'All'} to ${state.reportFilters.endDate || 'All'}`;
  const csvRows = [
    headers,
    ...rows.map((row) => [
      row.doctorName,
      row.officeName,
      row.processed,
      row.rate,
      row.totalPayable,
      row.paid,
      row.paidTotal,
      row.unpaid,
      row.unpaidTotal,
      dateRange
    ])
  ];
  const csv = csvRows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `doctor-payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function openDetailModal(type, id) {
  state.detailModal = { type, id };
  renderContent();
}

function closeDetailModal() {
  state.detailModal = null;
  renderContent();
}

function renderDetailModal() {
  if (!state.detailModal) return '';
  if (state.detailModal.type === 'case') {
    const medicalCase = (state.cases || []).find((item) => item.id === state.detailModal.id);
    if (!medicalCase) return '';
    return `
      <div class="modal-backdrop" data-action="close-detail-modal">
        <section class="modal-content case-detail-modal" role="dialog" aria-modal="true" aria-label="Medical case details">
          <div class="panel-header">
            <div>
              <h2>${escapeHtml(medicalCase.patientName)}</h2>
              <div class="muted">${escapeHtml(medicalCase.id)}</div>
            </div>
            <button class="secondary-btn" type="button" data-action="close-detail-modal">Close</button>
          </div>
          <div class="panel-body form-stack">
            ${recordSection('Case summary', [
              ['Case ID', medicalCase.id],
              ['Status', caseStatusLabels[medicalCase.status] || medicalCase.status],
              ['Stage', caseStageLabel(medicalCase)],
              ['Created', formatDateTime(medicalCase.createdAt)],
              ['Last updated', formatDateTime(medicalCase.updatedAt)],
              ['Route', medicalCase.route],
              ['Position', medicalCase.position],
              ['Employee/applicant ID', medicalCase.employeeId]
            ])}
            ${recordSection('Patient', [
              ['Name', medicalCase.patientName],
              ['Email', medicalCase.patientEmail],
              ['TRN / national ID', medicalCase.patientNationalId],
              ['Date of birth', medicalCase.patientDateOfBirth],
              ['Contact', medicalCase.patientContactNumber]
            ])}
            ${recordSection('Medical office and billing', [
              ['Medical office', medicalCase.assignedClinicianName || 'Unassigned'],
              ['Assigned', formatDateTime(medicalCase.assignedAt)],
              ['Doctor submitted', formatDateTime(medicalCase.submittedAt)],
              ['Billing status', paymentStatusLabel(doctorPaymentStatus(medicalCase))],
              ['Payable amount', medicalCase.payableAmount ? formatCurrency(medicalCase.payableAmount) : 'Not recorded'],
              ['Cancellation reason', medicalCase.cancellationReason || medicalCase.withdrawalReason || 'Not applicable']
            ])}
            <form class="grid-3" id="caseBillingQuickForm" data-case-id="${escapeHtml(medicalCase.id)}">
              <div class="field">
                <label for="modalPaymentStatus">Billing status</label>
                <select id="modalPaymentStatus" name="paymentStatus">
                  ${['unpaid', 'paid', 'not_payable'].map((status) => `<option value="${status}" ${doctorPaymentStatus(medicalCase) === status ? 'selected' : ''}>${escapeHtml(paymentStatusLabel(status))}</option>`).join('')}
                </select>
              </div>
              ${field('payableAmount', 'Payable amount', 'number', false, medicalCase.payableAmount || '')}
              <button class="secondary-btn" type="submit">Save billing</button>
            </form>
          </div>
        </section>
      </div>
    `;
  }
  return '';
}

function bindDetailModal() {
  document.querySelectorAll('[data-action="close-detail-modal"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target !== element && element.classList.contains('modal-backdrop')) return;
      closeDetailModal();
    });
  });
  document.querySelector('#caseBillingQuickForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api(`/api/cases/${encodeURIComponent(form.dataset.caseId)}`, {
      method: 'PATCH',
      body: {
        paymentStatus: data.get('paymentStatus'),
        payableAmount: data.get('payableAmount')
      }
    });
    state.detailModal = null;
    if (state.view === 'report-management') {
      state.reportManagementLoaded = false;
      await loadReportManagementData();
    } else {
      await loadCaseManagementData();
    }
    renderContent();
  });
}

function caseStageLabel(medicalCase) {
  const status = medicalCase?.status || '';
  if (['draft'].includes(status)) return 'HR creation';
  if (['sent_to_patient', 'patient_completed'].includes(status)) return 'Patient action';
  if (['sent_to_doctor', 'review_pending'].includes(status)) return 'Medical office action';
  if (['doctor_submitted'].includes(status)) return 'HR review';
  if (['reviewed'].includes(status)) return 'Completed';
  if (['canceled_by_doctor', 'withdrawn', 'deleted'].includes(status)) return 'Closed';
  return status ? 'In progress' : 'Not recorded';
}

function bindGlobalPatientSearch() {
  const input = document.querySelector('#globalPatientSearch');
  const results = document.querySelector('#globalPatientResults');
  if (!input || !results) return;
  if (!state.candidates.length) loadCaseManagementData();
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    const matches = state.candidates.filter((item) => [item.fullName, item.email, item.employeeId, item.position].join(' ').toLowerCase().includes(query)).slice(0, 6);
    results.innerHTML = matches.length ? matches.map((item) => `
      <button type="button" data-global-patient-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.fullName)}</strong>
        <span>${escapeHtml(item.email || item.employeeId || '')}</span>
      </button>
    `).join('') : '<div class="empty">No patients found.</div>';
    results.hidden = false;
    results.querySelectorAll('[data-global-patient-id]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = 'cases';
        state.prefillPatientId = button.dataset.globalPatientId;
        renderShell();
      });
    });
  });
}

function bindDoctorReports() {
  if (state.selectedDoctorReportCaseId) {
    document.querySelector('[data-action="back-to-doctor-reports"]')?.addEventListener('click', () => {
      state.selectedDoctorReportCaseId = '';
      state.selectedDoctorReportCase = null;
      state.selectedDoctorReportSubmission = null;
      renderContent();
    });
    const tabs = document.querySelector('#doctorReportTabs');
    if (tabs) bindTabs(tabs);
    return;
  }

  if (!state.doctorReportLoaded && !state.doctorReportLoading) loadDoctorReports();
  document.querySelector('[data-action="refresh-doctor-reports"]')?.addEventListener('click', loadDoctorReports);
  const search = document.querySelector('#doctorReportSearch');
  const runSearch = debounce((value) => {
    state.doctorReportSearch = value;
    state.doctorReportPage = 1;
    loadDoctorReports();
  }, 300);
  search?.addEventListener('input', (event) => runSearch(event.currentTarget.value));
  document.querySelector('#doctorReportStatus')?.addEventListener('change', (event) => {
    state.doctorReportStatus = event.currentTarget.value;
    state.doctorReportPage = 1;
    loadDoctorReports();
  });
  document.querySelector('#doctorReportPayment')?.addEventListener('change', (event) => {
    state.doctorReportPaymentStatus = event.currentTarget.value;
    state.doctorReportPage = 1;
    loadDoctorReports();
  });
  document.querySelector('[data-action="doctor-report-prev"]')?.addEventListener('click', () => {
    state.doctorReportPage = Math.max(1, state.doctorReportPage - 1);
    loadDoctorReports();
  });
  document.querySelector('[data-action="doctor-report-next"]')?.addEventListener('click', () => {
    if (!state.doctorReportPagination?.hasMore) return;
    state.doctorReportPage += 1;
    loadDoctorReports();
  });
  document.querySelectorAll('[data-open-doctor-report-case]').forEach((button) => {
    button.addEventListener('click', () => {
      openDoctorReportCase(button.dataset.openDoctorReportCase, button.dataset.submissionId);
    });
  });
}

async function loadDoctorReports() {
  state.doctorReportLoading = true;
  state.doctorReportError = '';
  if (state.view === 'doctor-reports' && state.doctorReportLoaded) renderContent();
  const params = new URLSearchParams({
    limit: '10',
    offset: String((state.doctorReportPage - 1) * 10)
  });
  if (state.doctorReportSearch.trim()) params.set('q', state.doctorReportSearch.trim());
  if (state.doctorReportStatus) params.set('status', state.doctorReportStatus);
  if (state.doctorReportPaymentStatus) params.set('paymentStatus', state.doctorReportPaymentStatus);
  try {
    const response = await api(`/api/reports/doctor-cases?${params.toString()}`);
    state.doctorReportRows = response.cases || [];
    state.doctorReportPagination = response.pagination || { total: 0, limit: 10, offset: 0, hasMore: false };
    state.doctorReportSummary = response.summary || state.doctorReportSummary;
    state.doctorReportLoaded = true;
  } catch (error) {
    try {
      const [casesResponse, submissionsResponse] = await Promise.all([
        api('/api/cases?limit=500'),
        api('/api/submissions?limit=500')
      ]);
      state.cases = casesResponse.cases || [];
      state.submissions = submissionsResponse.submissions || [];
      applyDoctorReportWorkspaceFallback();
      state.doctorReportError = 'The report service could not be reached. Showing current workspace data.';
      state.doctorReportLoaded = true;
    } catch {
      state.doctorReportRows = [];
      state.doctorReportPagination = { total: 0, limit: 10, offset: 0, hasMore: false };
      state.doctorReportError = error.message || 'Doctor reports could not be loaded.';
    }
  } finally {
    state.doctorReportLoading = false;
    if (state.view === 'doctor-reports' && !state.selectedDoctorReportCaseId) renderContent();
  }
}

function applyDoctorReportWorkspaceFallback() {
  const casesById = new Map((state.cases || []).map((medicalCase) => [medicalCase.id, medicalCase]));
  const allRows = (state.submissions || []).map((submission) => {
    const medicalCase = casesById.get(submission.caseId) || {};
    return {
      id: medicalCase.id || submission.caseId,
      submissionId: submission.id,
      patientName: medicalCase.patientName || submission.candidateName || '',
      employeeId: medicalCase.employeeId || submission.employeeId || '',
      position: medicalCase.position || submission.position || '',
      submittedAt: submission.submittedAt || medicalCase.submittedAt || '',
      assignedAt: medicalCase.assignedAt || '',
      status: medicalCase.status || 'doctor_submitted',
      paymentStatus: doctorPaymentStatus(medicalCase),
      payableAmount: doctorPayableAmount(medicalCase),
      determinationStatus: submission.determinationStatus || '',
      reviewStatus: submission.reviewStatus || 'pending'
    };
  }).sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  const query = state.doctorReportSearch.trim().toLowerCase();
  const filtered = allRows.filter((row) => {
    if (state.doctorReportStatus && row.status !== state.doctorReportStatus) return false;
    if (state.doctorReportPaymentStatus && row.paymentStatus !== state.doctorReportPaymentStatus) return false;
    if (!query) return true;
    return [row.patientName, row.id, row.employeeId, row.position]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const limit = 10;
  const offset = (state.doctorReportPage - 1) * limit;
  state.doctorReportRows = filtered.slice(offset, offset + limit);
  state.doctorReportPagination = {
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + limit < filtered.length
  };
  state.doctorReportSummary = doctorReportWorkspaceSummary(allRows);
}

function doctorReportWorkspaceSummary(rows) {
  const currentMonth = monthKeyLocal(new Date().toISOString());
  const unpaid = rows.filter((row) => row.paymentStatus === 'unpaid');
  const turnaround = rows
    .map((row) => {
      const assigned = new Date(row.assignedAt).getTime();
      const submitted = new Date(row.submittedAt).getTime();
      return Number.isFinite(assigned) && Number.isFinite(submitted) && submitted >= assigned
        ? (submitted - assigned) / 3600000
        : null;
    })
    .filter((value) => value !== null);
  return {
    processed: rows.length,
    processedThisMonth: rows.filter((row) => monthKeyLocal(row.submittedAt) === currentMonth).length,
    pendingHrReview: rows.filter((row) => ['doctor_submitted', 'review_pending'].includes(row.status)).length,
    unpaidCount: unpaid.length,
    unpaidAmount: unpaid.reduce((total, row) => total + Number(row.payableAmount || 0), 0),
    paidCount: rows.filter((row) => row.paymentStatus === 'paid').length,
    followUpCount: rows.filter((row) => row.reviewStatus === 'needs_follow_up').length,
    averageTurnaroundHours: turnaround.length
      ? Math.round(turnaround.reduce((total, value) => total + value, 0) / turnaround.length)
      : 0
  };
}

async function openDoctorReportCase(caseId, submissionId) {
  state.selectedDoctorReportCaseId = caseId;
  state.selectedDoctorReportCase = null;
  state.selectedDoctorReportSubmission = null;
  renderContent();
  try {
    const [caseResponse, submissionResponse] = await Promise.all([
      api(`/api/cases/${encodeURIComponent(caseId)}`),
      api(`/api/submissions/${encodeURIComponent(submissionId)}`)
    ]);
    if (state.selectedDoctorReportCaseId !== caseId) return;
    state.selectedDoctorReportCase = caseResponse.case || null;
    state.selectedDoctorReportSubmission = submissionResponse.submission || null;
  } catch {
    if (state.selectedDoctorReportCaseId === caseId) {
      state.selectedDoctorReportCase = (state.cases || []).find((item) => item.id === caseId) || null;
    }
  }
  if (state.view === 'doctor-reports' && state.selectedDoctorReportCaseId === caseId) renderContent();
}

function doctorMonthlyPaymentRows() {
  const casesById = new Map((state.cases || []).map((item) => [item.id, item]));
  const rows = new Map();
  for (const submission of state.submissions || []) {
    const month = monthKeyLocal(submission.submittedAt);
    const row = rows.get(month) || { month, completed: 0, paid: 0, unpaid: 0, due: 0 };
    const medicalCase = casesById.get(submission.caseId);
    const status = doctorPaymentStatus(medicalCase || {});
    row.completed += 1;
    if (status === 'paid') row.paid += 1;
    if (status === 'unpaid') {
      row.unpaid += 1;
      row.due += doctorPayableAmount(medicalCase || {});
    }
    rows.set(month, row);
  }
  return [...rows.values()].sort((left, right) => right.month.localeCompare(left.month));
}

function doctorPaymentStatus(medicalCase) {
  if (['canceled_by_doctor', 'withdrawn'].includes(medicalCase.status)) return 'not_payable';
  return medicalCase.paymentStatus || 'unpaid';
}

function doctorPayableAmount(medicalCase) {
  return Number(medicalCase.payableAmount || state.user.medicalProfile?.defaultMedicalFee || 0);
}

function paymentStatusLabel(value) {
  return { paid: 'Paid', unpaid: 'Unpaid', not_payable: 'Not payable' }[value] || value || 'Unpaid';
}

function labelStatus(value) {
  return statusLabels[value] || caseStatusLabels[value] || value || '';
}

function casePhaseLabel(status) {
  if (status === 'sent_to_patient') return 'Patient action';
  if (status === 'sent_to_doctor') return 'Doctor office';
  if (status === 'doctor_submitted') return 'HR review';
  if (status === 'reviewed' || status === 'archived') return 'Completed';
  if (status === 'withdrawn' || status === 'canceled_by_doctor') return 'Closed';
  return caseStatusLabels[status] || status || 'Draft';
}

function renderCasePhase(medicalCase) {
  const steps = [
    { key: 'patient', label: 'Patient', active: ['sent_to_patient', 'patient_completed'].includes(medicalCase.status) },
    { key: 'doctor', label: 'Doctor', active: medicalCase.status === 'sent_to_doctor' },
    { key: 'hr', label: 'HR review', active: medicalCase.status === 'doctor_submitted' || medicalCase.status === 'review_pending' },
    { key: 'complete', label: 'Complete', active: ['reviewed', 'archived'].includes(medicalCase.status) }
  ];
  return `
    <div class="case-phase" aria-label="Medical phase">
      <strong>${escapeHtml(casePhaseLabel(medicalCase.status))}</strong>
      <div class="case-phase-track">
        ${steps.map((step) => `<span class="${step.active ? 'is-active' : ''}">${escapeHtml(step.label)}</span>`).join('')}
      </div>
    </div>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function monthKeyLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 7);
}

function bindAssessmentForm() {
  const form = document.querySelector('#assessmentForm');
  const error = document.querySelector('#formError');
  const editing = state.editingSubmissionRecord;
  if (editing) {
    fillSubmissionForm(form, editing);
  } else {
    populateDoctorProfile(form);
  }
  loadDoctorCandidates(form, editing?.candidate?.candidateId || state.selectedDoctorCaseId || '');
  applyFormTemplate(form, 'doctor');
  bindTabs(form);
  bindDoctorFormNavigation(form);
  bindSignatureUpload(form);
  bindSignaturePad(form);
  bindDraftCancelAndAttachments(form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isDoctorOfficeUser(state.user)) {
      error.textContent = 'Final submission must be completed by a doctor.';
      error.classList.add('is-visible');
      return;
    }
    if (!validateDoctorFormBeforeSubmit(form)) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    error.classList.remove('is-visible');

    try {
      const path = editing ? `/api/submissions/${encodeURIComponent(editing.id)}` : '/api/submissions';
      const response = await api(path, {
        method: editing ? 'PATCH' : 'POST',
        body: { ...formToSubmission(form), intent: 'final' }
      });
      await loadSubmissions();
      state.view = 'mine';
      state.selectedSubmission = response.id || response.submission?.id || editing?.id;
      state.editingSubmissionRecord = null;
      renderShell();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add('is-visible');
    } finally {
      submit.disabled = false;
    }
  });
}

function populateDoctorProfile(form) {
  const profile = state.user.medicalProfile || {};
  const defaults = {
    'assessment.facilityName': profile.facilityName,
    'assessment.facilityAddress': profile.facilityAddress,
    'assessment.clinicianName': profile.clinicianName || state.user.displayName,
    'assessment.clinicianRegistrationNumber': profile.registrationNumber,
    'assessment.telephoneNumber': profile.telephoneNumber,
    'assessment.faxNumber': profile.faxNumber,
    'assessment.emailAddress': state.user.email,
    'attestation.signedBy': profile.clinicianName || state.user.displayName,
    'attestation.signatureDataUrl': profile.signatureDataUrl
  };
  Object.entries(defaults).forEach(([name, value]) => {
    if (form.elements[name] && value) form.elements[name].value = value;
  });
}

function bindTabs(form) {
  form.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveDoctorTab(form, Number(button.dataset.tab || 0));
    });
  });
}

function doctorTabLabels() {
  return ['Patient information', 'Doctor assessment', 'Tests', 'Determination', 'Attachments & signature'];
}

function activeDoctorTab(form) {
  return Number(form.querySelector('[data-tab].is-active')?.dataset.tab || 0);
}

function setActiveDoctorTab(form, index) {
  form.querySelectorAll('[data-tab]').forEach((button) => {
    const isActive = button.dataset.tab === String(index);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  form.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.tabPanel === String(index));
  });
  if (index === doctorTabLabels().length - 1) {
    window.requestAnimationFrame(() => form.signaturePadController?.resize());
  }
  updateDoctorFormNavigation(form);
}

function bindDoctorFormNavigation(form) {
  form.querySelector('[data-action="doctor-prev-tab"]')?.addEventListener('click', () => {
    setActiveDoctorTab(form, Math.max(0, activeDoctorTab(form) - 1));
  });
  form.querySelector('[data-action="doctor-next-tab"]')?.addEventListener('click', () => {
    const labels = doctorTabLabels();
    setActiveDoctorTab(form, Math.min(labels.length - 1, activeDoctorTab(form) + 1));
  });
  updateDoctorFormNavigation(form);
}

function updateDoctorFormNavigation(form) {
  const index = activeDoctorTab(form);
  const labels = doctorTabLabels();
  const lastIndex = labels.length - 1;
  const prev = form.querySelector('[data-action="doctor-prev-tab"]');
  const next = form.querySelector('[data-action="doctor-next-tab"]');
  const submit = form.querySelector('#doctorFinalSubmit');
  if (prev) {
    prev.hidden = index === 0;
    if (index > 0) prev.textContent = `Previous: ${labels[index - 1]}`;
  }
  if (next) {
    next.hidden = index === lastIndex;
    if (index < lastIndex) next.textContent = `Next: ${labels[index + 1]}`;
  }
  if (submit) submit.hidden = index !== lastIndex || !isDoctorOfficeUser(state.user);
}

function validateDoctorFormBeforeSubmit(form) {
  const invalid = Array.from(form.querySelectorAll('input, select, textarea')).find((field) => !field.disabled && !field.checkValidity());
  if (!invalid) return true;
  const tabIndex = Number(invalid.closest('[data-tab-panel]')?.dataset.tabPanel || 0);
  setActiveDoctorTab(form, tabIndex);
  invalid.reportValidity();
  invalid.focus({ preventScroll: true });
  invalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return false;
}

function bindSignatureUpload(form) {
  const input = form.querySelector('#signatureUpload');
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      input.value = '';
      showFormError('Signature upload must be a PNG, JPG, or WebP image.');
      return;
    }
    const hidden = form.elements['attestation.signatureDataUrl'];
    hidden.value = await fileToDataUrl(file);
    setDoctorSignatureDate(form, true);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    showFormError('Signature image uploaded.', false);
  });
}

function bindSignaturePad(form) {
  const canvas = form.querySelector('#signaturePad');
  const hidden = form.elements['attestation.signatureDataUrl'];
  if (!canvas || !hidden) return;
  const pad = window.LocalSignaturePad ? new window.LocalSignaturePad(canvas) : null;
  form.signaturePadController = pad;
  if (hidden.value && pad) pad.fromDataUrl(hidden.value);
  setDoctorSignatureDate(form, Boolean(hidden.value));
  const markSigned = () => {
    hidden.value = pad ? pad.toDataUrl() : canvas.toDataURL('image/png');
    setDoctorSignatureDate(form, true);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };
  canvas.addEventListener('pointerup', markSigned);
  form.querySelector('[data-action="clear-signature"]')?.addEventListener('click', () => {
    if (pad) pad.clear();
    else canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    hidden.value = '';
    setDoctorSignatureDate(form, false);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  });
  form.querySelector('[data-action="use-typed-signature"]')?.addEventListener('click', () => {
    drawTypedSignature(canvas, form.elements['attestation.signedBy'].value || state.user.displayName);
    hidden.value = canvas.toDataURL('image/png');
    setDoctorSignatureDate(form, true);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setDoctorSignatureDate(form, signed) {
  const date = form.elements['attestation.signatureDate'];
  if (!date) return;
  date.readOnly = true;
  if (signed && !date.value) date.value = new Date().toISOString().slice(0, 10);
  if (!signed) date.value = '';
}

function drawTypedSignature(canvas, name) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '36px "Segoe Script", "Brush Script MT", cursive';
  context.fillStyle = '#17202a';
  context.fillText(name, 26, 98);
}

function bindDraftCancelAndAttachments(form) {
  form.querySelector('[data-action="save-draft"]')?.addEventListener('click', async () => {
    const caseId = currentCaseId(form);
    if (!caseId) return showFormError('Select an assigned medical case before saving a draft.');
    await api(`/api/cases/${encodeURIComponent(caseId)}/draft`, {
      method: 'PUT',
      body: { draft: formToSubmission(form) }
    });
    showFormError('Draft saved.', false);
  });

  form.querySelector('[data-action="cancel-case"]')?.addEventListener('click', async () => {
    const caseId = currentCaseId(form);
    if (!caseId) return showFormError('Select an assigned medical case before canceling.');
    const reason = window.prompt('Reason for canceling this medical case');
    if (!reason) return;
    await api(`/api/cases/${encodeURIComponent(caseId)}/cancel`, {
      method: 'POST',
      body: { reason }
    });
    await loadSubmissions();
    renderShell();
  });

  form.querySelector('#caseAttachmentUpload')?.addEventListener('change', async (event) => {
    const caseId = currentCaseId(form);
    const file = event.currentTarget.files?.[0];
    if (!caseId || !file) return;
    if (!isAllowedImageFile(file)) {
      event.currentTarget.value = '';
      return showFormError('Case attachments must be PNG, JPG, or WebP images.');
    }
    const dataUrl = await fileToDataUrl(file);
    const response = await api(`/api/cases/${encodeURIComponent(caseId)}/attachments`, {
      method: 'POST',
      body: {
        fileName: file.name,
        contentType: file.type,
        dataUrl
      }
    });
    renderAttachmentList(response.case?.attachments || []);
    event.currentTarget.value = '';
  });
}

function isAllowedImageFile(file) {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(file?.type);
}

function currentCaseId(form) {
  return form.elements['candidate.caseId']?.value || form.elements['candidate.candidateId']?.value || '';
}

function showFormError(message, isError = true) {
  const error = document.querySelector('#formError');
  if (!error) return;
  error.textContent = message;
  error.classList.add('is-visible');
  error.classList.toggle('notice', !isError);
}

function renderAttachmentList(attachments = []) {
  const list = document.querySelector('#attachmentList');
  if (!list) return;
  list.innerHTML = attachments.length
    ? attachments.map((item) => `<div class="attachment-item">${escapeHtml(item.fileName)} <span class="muted">${escapeHtml(formatBytes(item.size))}</span></div>`).join('')
    : '<div class="muted">No attachments uploaded.</div>';
}

async function loadDoctorCandidates(form, selectedCandidateId = '') {
  try {
    const response = await api('/api/cases');
    state.cases = response.cases || [];
    const select = form.querySelector('#candidate-select');
    if (!select) {
      if (selectedCandidateId) populateCandidateFields(form, selectedCandidateId);
      return;
    }
    select.innerHTML = '<option value="">Select assigned medical case</option>' + state.cases
      .filter((medicalCase) => ['sent_to_doctor', 'doctor_submitted', 'review_pending'].includes(medicalCase.status))
      .map((medicalCase) => `<option value="${escapeHtml(medicalCase.id)}">${escapeHtml(medicalCase.patientName)} - ${escapeHtml(medicalCase.position || 'Position not recorded')}</option>`)
      .join('');
    if (selectedCandidateId) {
      const selected = state.editingSubmissionRecord?.candidate || {};
      if (![...select.options].some((option) => option.value === selectedCandidateId)) {
        select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(selectedCandidateId)}">${escapeHtml(selected.fullName || 'Submitted patient')}</option>`);
      }
      select.value = selectedCandidateId;
    }
    select.addEventListener('change', () => populateCandidateFields(form, select.value));
    if (select.value) populateCandidateFields(form, select.value);
  } catch (err) {
    const select = form.querySelector('#candidate-select');
    select.innerHTML = `<option value="">${escapeHtml(err.message)}</option>`;
  }
}

function populateCandidateFields(form, candidateId) {
  const medicalCase = state.cases.find((item) => item.id === candidateId);
  if (!medicalCase) return;
  const banner = form.querySelector('#selectedCaseBanner');
  if (banner) {
    banner.innerHTML = `
      <strong>${escapeHtml(medicalCase.patientName || 'Patient')}</strong>
      <span>${escapeHtml(medicalCase.employeeId || medicalCase.patientEmail || medicalCase.id)}</span>
      <span>${escapeHtml(medicalCase.position || 'Position not recorded')}</span>
    `;
  }
  const context = form.querySelector('#doctorPatientContext');
  if (context) context.innerHTML = renderDoctorPatientContext(medicalCase);
  const values = {
    'candidate.candidateId': medicalCase.id,
    'candidate.caseId': medicalCase.id,
    'candidate.patientId': medicalCase.patientId,
    'candidate.fullName': medicalCase.patientName,
    'candidate.employeeId': medicalCase.employeeId,
    'candidate.nationalId': medicalCase.patientNationalId,
    'candidate.dateOfBirth': medicalCase.patientDateOfBirth,
    'candidate.email': medicalCase.patientEmail,
    'candidate.contactNumber': medicalCase.patientContactNumber,
    'candidate.position': medicalCase.position
  };
  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name] && value !== undefined && value !== null) form.elements[name].value = value;
  });
  fillSubmissionForm(form, medicalCase.doctorDraft || {});
  fillPatientCaseData(form, medicalCase.patientCaseData || {});
  renderAttachmentList(medicalCase.attachments || []);
  setPatientFieldsReadonly(form);
  applyFormTemplate(form, 'doctor');
}

function renderDoctorPatientContext(medicalCase) {
  const data = medicalCase?.patientCaseData || {};
  const personal = data.personalInfo || {};
  const consent = data.consent || {};
  const family = data.familyHistory || {};
  const history = data.medicalHistory || {};
  return `
    <div class="doctor-readonly-section">
      <h4>Profile and contact details</h4>
      ${readonlyKeyValueGrid([
        ['First name', personal.firstName],
        ['Middle initial', personal.middleInitial],
        ['Last name', personal.lastName],
        ['Sex', personal.sex],
        ['Marital status', personal.maritalStatus],
        ['Employee/applicant ID', medicalCase.employeeId],
        ['TRN / national ID', medicalCase.patientNationalId],
        ['Date of birth', medicalCase.patientDateOfBirth],
        ['Email', medicalCase.patientEmail],
        ['Position applied for', medicalCase.position]
      ])}
    </div>
    <div class="doctor-readonly-section">
      <h4>Address and phone numbers</h4>
      ${readonlyKeyValueGrid([
        ['Address line 1', personal.addressLine1 || personal.address],
        ['Address line 2', personal.addressLine2],
        ['City / town', personal.cityTown],
        ['Parish / state', personal.parish],
        ['Country', personal.country],
        ['Home phone', personal.homePhone || personal.phoneNumber],
        ['Mobile phone', personal.mobilePhone || medicalCase.patientContactNumber],
        ['Work phone', personal.workPhone]
      ])}
    </div>
    <div class="doctor-readonly-section">
      <h4>Primary doctor and emergency contact</h4>
      ${readonlyKeyValueGrid([
        ['Primary doctor name', personal.primaryPhysician],
        ['Primary doctor address', personal.primaryPhysicianAddress],
        ['Primary doctor phone', personal.primaryPhysicianPhone],
        ['Emergency contact name', personal.emergencyContactName],
        ['Emergency contact number', personal.emergencyContactNumber]
      ])}
    </div>
    <div class="doctor-readonly-section">
      <h4>Consent and certification</h4>
      ${readonlyKeyValueGrid([
        ['Consent accepted', consent.accepted ? 'Yes' : 'No'],
        ['Signed by', consent.signedBy],
        ['Signed date', formatDateTime(consent.signedAt)]
      ])}
      ${consent.signatureDataUrl ? `
        <div class="case-signature-card patient-legal-signature">
          <strong>Patient signature</strong>
          <span class="muted">Signed by ${escapeHtml(consent.signedBy || medicalCase.patientName || 'patient')} on ${escapeHtml(formatDateTime(consent.signedAt) || 'date not recorded')}</span>
          <img src="${escapeHtml(consent.signatureDataUrl)}" alt="Patient signature">
        </div>
      ` : '<div class="notice is-quiet">No patient signature is recorded for this medical case.</div>'}
    </div>
    <div class="doctor-readonly-section">
      <h4>Family relatives</h4>
      ${readonlyTable(['Relative', 'Age, if alive', 'State of health or cause of death', 'Age at death'], (family.relatives || []).map((row) => [
        row.relationship,
        row.age,
        row.stateOfHealth,
        row.ageAtDeath
      ]))}
    </div>
    <div class="doctor-readonly-section">
      <h4>Family illnesses or disorders</h4>
      ${readonlyTable(['Illness or disorder', 'Answer', 'Who'], (family.disorders || []).map((row) => [
        row.name,
        patientAnswerLabel(row.answer),
        row.who
      ]))}
      ${readonlyNotes('Family history notes', family.notes)}
    </div>
    <div class="doctor-readonly-section">
      <h4>Diseases or disorders</h4>
      ${readonlyTable(['Disease or disorder', 'Answer', 'Year'], (history.diseases || []).map((row) => [
        row.name,
        patientAnswerLabel(row.answer),
        row.year
      ]))}
    </div>
    <div class="doctor-readonly-section">
      <h4>Additional medical questions</h4>
      ${readonlyTable(['Question', 'Answer', 'Details'], (history.questions || []).map((row) => [
        medicalQuestionLabel(row.key),
        row.type === 'text' || row.type === 'textarea' ? 'Response' : patientAnswerLabel(row.answer),
        patientQuestionDetails(row)
      ]))}
      ${readonlyNotes('Additional notes', history.notes)}
    </div>
  `;
}

function readonlyKeyValueGrid(rows) {
  return `
    <dl class="doctor-readonly-grid">
      ${rows.map(([label, value]) => `
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value || 'Not recorded')}</dd>
      `).join('')}
    </dl>
  `;
}

function readonlyTable(headers, rows) {
  if (!rows.length) return '<div class="muted">Not recorded.</div>';
  const columns = `repeat(${headers.length}, minmax(0, 1fr))`;
  return `
    <div class="readonly-table">
      <div class="readonly-table-row readonly-table-head" style="grid-template-columns:${escapeHtml(columns)}">
        ${headers.map((header) => `<strong>${escapeHtml(header)}</strong>`).join('')}
      </div>
      ${rows.map((row) => `
        <div class="readonly-table-row" style="grid-template-columns:${escapeHtml(columns)}">
          ${row.map((value) => `<span>${escapeHtml(value || 'Not recorded')}</span>`).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function readonlyNotes(label, value) {
  if (!value) return '';
  return `
    <div class="readonly-notes">
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
}

function patientAnswerLabel(value) {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return 'Not recorded';
}

function medicalQuestionLabel(key) {
  return medicalQuestionCatalog().find((item) => item.key === key)?.question || key || 'Question';
}

function patientQuestionDetails(row) {
  const extras = Object.entries(row.extras || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
  return [row.detail, row.value, ...extras].filter(Boolean).join('; ');
}

function fillPatientCaseData(form, data) {
  const values = {
    'candidate.medicationInformation': patientMedicalQuestionDetail(data.medicalHistory, 'regularMedicine') || data.medicalHistory?.medications || '',
    'familyHistory.notes': data.familyHistory?.notes || '',
    'medicalHistory.notes': patientMedicalHistorySummary(data.medicalHistory)
  };
  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value || '';
  });
  ['hypertension', 'diabetes', 'heartDisease', 'asthma', 'cancer', 'stroke', 'kidneyDisease', 'mentalHealth'].forEach((key) => {
    if (form.elements[`familyHistory.${key}`]) form.elements[`familyHistory.${key}`].checked = Boolean(data.familyHistory?.[key]);
  });
}

function patientMedicalQuestionDetail(history, key) {
  const question = history?.questions?.find((item) => item.key === key);
  return question?.detail || question?.value || '';
}

function patientMedicalHistorySummary(history = {}) {
  const diseaseSummary = Array.isArray(history.diseases)
    ? history.diseases
      .filter((item) => item.answer === 'yes')
      .map((item) => `${item.name}${item.year ? ` (${item.year})` : ''}`)
    : [];
  const questionSummary = Array.isArray(history.questions)
    ? history.questions
      .map((item) => {
        if (item.type === 'text' || item.type === 'textarea') return item.value ? `${item.key}: ${item.value}` : '';
        if (item.answer !== 'yes') return '';
        const extras = Object.values(item.extras || {}).filter(Boolean).join('; ');
        return [item.detail, extras].filter(Boolean).join('; ');
      })
      .filter(Boolean)
    : [];
  return [
    diseaseSummary.length && `Diseases/disorders marked yes: ${diseaseSummary.join(', ')}`,
    questionSummary.length && `Questionnaire details:\n${questionSummary.join('\n')}`,
    history.previousIllnesses && `Previous illnesses: ${history.previousIllnesses}`,
    history.surgeries && `Surgeries/procedures: ${history.surgeries}`,
    history.allergies && `Allergies: ${history.allergies}`,
    history.medications && `Current medications: ${history.medications}`,
    history.chronicConditions && `Chronic conditions: ${history.chronicConditions}`,
    history.hospitalizations && `Prior hospitalizations: ${history.hospitalizations}`,
    history.notes && `Additional notes: ${history.notes}`
  ].filter(Boolean).join('\n');
}

function setPatientFieldsReadonly(form) {
  [
    'candidate.fullName',
    'candidate.employeeId',
    'candidate.nationalId',
    'candidate.dateOfBirth',
    'candidate.email',
    'candidate.contactNumber',
    'candidate.position',
    'candidate.medicationInformation'
  ].forEach((name) => {
    if (form.elements[name]) form.elements[name].readOnly = true;
  });
  ['hypertension', 'diabetes', 'heartDisease', 'asthma', 'cancer', 'stroke', 'kidneyDisease', 'mentalHealth'].forEach((key) => {
    const input = form.elements[`familyHistory.${key}`];
    if (input) input.addEventListener('click', (event) => event.preventDefault());
  });
  ['familyHistory.notes', 'medicalHistory.notes'].forEach((name) => {
    if (form.elements[name]) form.elements[name].readOnly = true;
  });
}

function fillSubmissionForm(form, submission) {
  const values = {
    'candidate.candidateId': submission.candidate?.candidateId,
    'candidate.fullName': submission.candidate?.fullName,
    'candidate.caseId': submission.caseId || submission.candidate?.caseId || submission.candidate?.candidateId,
    'candidate.patientId': submission.patientId || submission.candidate?.patientId,
    'candidate.candidateId': submission.caseId || submission.candidate?.caseId || submission.candidate?.candidateId,
    'candidate.employeeId': submission.candidate?.employeeId,
    'candidate.nationalId': submission.candidate?.nationalId,
    'candidate.dateOfBirth': submission.candidate?.dateOfBirth,
    'candidate.email': submission.candidate?.email,
    'candidate.contactNumber': submission.candidate?.contactNumber,
    'candidate.position': submission.candidate?.position,
    'candidate.medicationInformation': submission.candidate?.medicationInformation,
    'assessment.facilityName': submission.assessment?.facilityName,
    'assessment.assessmentDate': submission.assessment?.assessmentDate,
    'assessment.facilityAddress': submission.assessment?.facilityAddress,
    'assessment.clinicianName': submission.assessment?.clinicianName,
    'assessment.clinicianRegistrationNumber': submission.assessment?.clinicianRegistrationNumber,
    'assessment.telephoneNumber': submission.assessment?.telephoneNumber,
    'assessment.faxNumber': submission.assessment?.faxNumber,
    'assessment.emailAddress': submission.assessment?.emailAddress,
    'medicalHistory.notes': submission.medicalHistory?.notes,
    'familyHistory.notes': submission.familyHistory?.notes,
    ...doctorPhysicalExamValues(submission),
    'labResults.additionalTests': submission.labResults?.additionalTests,
    'determination.status': submission.determination?.status,
    'determination.conclusions': submission.determination?.conclusions,
    'determination.followUpDate': submission.determination?.followUpDate,
    'determination.restrictions': submission.determination?.restrictions,
    'determination.recommendation': submission.determination?.recommendation,
    'attestation.signedBy': submission.attestation?.signedBy,
    'attestation.signatureDate': submission.attestation?.signatureDate,
    'attestation.signatureDataUrl': submission.attestation?.signatureDataUrl
  };
  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value || '';
  });
  ['cardiac', 'respiratory', 'diabetes', 'hypertension', 'allergies', 'surgeries', 'medications', 'mentalHealth', 'infectiousDisease'].forEach((key) => {
    if (form.elements[`medicalHistory.${key}`]) form.elements[`medicalHistory.${key}`].checked = Boolean(submission.medicalHistory?.[key]);
  });
  ['hypertension', 'diabetes', 'heartDisease', 'asthma', 'cancer', 'stroke', 'kidneyDisease', 'mentalHealth'].forEach((key) => {
    if (form.elements[`familyHistory.${key}`]) form.elements[`familyHistory.${key}`].checked = Boolean(submission.familyHistory?.[key]);
  });
  if (form.elements['attestation.consentConfirmed']) form.elements['attestation.consentConfirmed'].checked = Boolean(submission.attestation?.consentConfirmed);
}

function doctorPhysicalExamValues(submission) {
  const exam = submission.physicalExam || {};
  const legacy = {
    generalAppearance: exam.general,
    pulseRate: submission.vitals?.pulse,
    bloodPressure: submission.vitals?.bloodPressure,
    thorax: exam.respiratory,
    skull: exam.musculoskeletal,
    fundi: exam.nervousSystem,
    disabilities: exam.comments
  };
  return Object.fromEntries(physicianExamFieldKeys.map((key) => [
    `physicalExam.${key}`,
    exam[key] || legacy[key] || ''
  ]));
}

function renderSubmissionBrowser(title, options = {}) {
  const submissions = options.submissions || state.submissions;
  const intro = options.intro || state.settings.reviewerIntro;
  const selectedId = state.selectedSubmission || submissions[0]?.id || '';
  const selected = submissions.find((item) => item.id === selectedId);
  return `
    <div class="toolbar">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <div class="muted">${escapeHtml(intro)} ${submissions.length} record${submissions.length === 1 ? '' : 's'}.</div>
      </div>
      <button class="secondary-btn" data-action="refresh">Refresh</button>
    </div>
    <div class="detail-grid">
      <section class="panel">
        <div class="panel-header">
          <h3>Records</h3>
        </div>
        <div class="list">
          ${submissions.length ? submissions.map((item) => renderSubmissionListItem(item, item.id === selectedId)).join('') : '<div class="empty">No submissions yet.</div>'}
        </div>
      </section>
      <section class="panel" id="recordDetail">
        ${selected ? '<div class="empty">Loading record</div>' : '<div class="empty">Select a record.</div>'}
      </section>
    </div>
  `;
}

function renderArchiveBrowser() {
  return `
    <div class="toolbar">
      <div>
        <h2>Archive</h2>
        <div class="muted">Archived medical forms remain searchable and retrievable by authorized reviewers.</div>
      </div>
      <button class="secondary-btn" data-action="refresh">Refresh</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <div class="field search-field">
          <label for="archiveSearch">Search archived forms</label>
          <input id="archiveSearch" type="search" value="${escapeHtml(state.archiveQuery)}" placeholder="Search by candidate, ID, doctor, facility, or position">
        </div>
      </div>
    </div>
    <div id="archiveResults">
      ${renderSubmissionBrowser('Archived records', { submissions: getFilteredArchivedSubmissions() })}
    </div>
  `;
}

function bindArchiveBrowser() {
  bindSubmissionBrowser();
  document.querySelector('#archiveSearch')?.addEventListener('input', (event) => {
    state.archiveQuery = event.currentTarget.value;
    const results = document.querySelector('#archiveResults');
    if (!results) return;
    results.innerHTML = renderSubmissionBrowser('Archived records', { submissions: getFilteredArchivedSubmissions() });
    bindSubmissionBrowser();
  });
}

function getFilteredArchivedSubmissions() {
  const query = state.archiveQuery.trim().toLowerCase();
  return state.submissions
    .filter((submission) => submission.reviewStatus === 'archived')
    .filter((submission) => {
      if (!query) return true;
      return [submission.candidateName, submission.employeeId, submission.position, submission.facilityName, submission.clinicianName, submission.id]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
}

function bindSubmissionBrowser() {
  document.querySelector('[data-action="refresh"]')?.addEventListener('click', async () => {
    await loadSubmissions();
    renderShell();
  });

  document.querySelectorAll('[data-submission-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSubmission = button.dataset.submissionId;
      renderShell();
    });
  });

  const selectedId = document.querySelector('.list-item.is-active')?.dataset.submissionId || document.querySelector('[data-submission-id]')?.dataset.submissionId;
  if (selectedId) {
    loadSubmissionDetail(selectedId);
  }
}

async function loadSubmissionDetail(id) {
  const detail = document.querySelector('#recordDetail');
  try {
    const response = await api(`/api/submissions/${encodeURIComponent(id)}`);
    state.selectedSubmission = id;
    detail.innerHTML = renderSubmissionDetail(response.submission);
    bindReviewForm(response.submission);
  } catch (err) {
    detail.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function bindReviewForm(submission) {
  document.querySelector('[data-action="edit-follow-up"]')?.addEventListener('click', () => {
    state.editingSubmissionRecord = submission;
    state.view = 'submit';
    renderShell();
  });

  const form = document.querySelector('#reviewForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api(`/api/submissions/${encodeURIComponent(submission.id)}/review`, {
        method: 'PATCH',
        body: {
          status: form.status.value,
          notes: form.notes.value
        }
      });
      await loadSubmissions();
      renderShell();
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector('[data-action="archive-record"]')?.addEventListener('click', async () => {
    const button = document.querySelector('[data-action="archive-record"]');
    button.disabled = true;
    try {
      await api(`/api/submissions/${encodeURIComponent(submission.id)}/review`, {
        method: 'PATCH',
        body: {
          status: 'archived',
          notes: form.notes.value
        }
      });
      await loadSubmissions();
      state.selectedSubmission = submission.id;
      state.view = 'archive';
      renderShell();
    } finally {
      button.disabled = false;
    }
  });
}

function renderSubmissionListItem(item, active) {
  return `
    <button class="list-item ${active ? 'is-active' : ''}" data-submission-id="${escapeHtml(item.id)}">
      <span class="item-line">
        <strong>${escapeHtml(item.candidateName)}</strong>
        <span class="status ${escapeHtml(item.reviewStatus)}">${escapeHtml(statusLabels[item.reviewStatus] || item.reviewStatus)}</span>
      </span>
      <span class="muted">${escapeHtml(item.position || 'Position not recorded')}</span>
      <span class="muted">${escapeHtml(formatDateTime(item.submittedAt))}</span>
    </button>
  `;
}

function renderSubmissionDetail(submission) {
  const canViewMedical = state.user.role !== ROLES.PATIENT;
  if (!canViewMedical) {
    return `
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(submission.candidate.fullName)}</h2>
          <div class="muted">${escapeHtml(submission.caseId || submission.id)}</div>
        </div>
      </div>
      <div class="panel-body">
        ${recordSection('Case summary', [
          ['Position', submission.candidate.position],
          ['Submitted', formatDateTime(submission.submittedAt)],
          ['Review status', statusLabels[submission.review?.status || 'pending']]
        ])}
      </div>
    `;
  }
  const canEditFollowUp = can(PERMISSIONS.SUBMISSIONS_FOLLOW_UP) && submission.review?.status === 'needs_follow_up';
  const reviewerTools = can(PERMISSIONS.SUBMISSIONS_REVIEW) ? `
    <div class="record-section">
      <h3>Review</h3>
      <form id="reviewForm" class="form-stack">
        <div class="grid-2">
          <div class="field">
            <label for="review-status">Status</label>
            <select id="review-status" name="status">
              ${['pending', 'reviewed', 'needs_follow_up', 'archived'].map((status) => `
                <option value="${status}" ${submission.review?.status === status ? 'selected' : ''}>${escapeHtml(statusLabels[status])}</option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>Submitted</label>
            <input value="${escapeHtml(formatDateTime(submission.submittedAt))}" disabled>
          </div>
        </div>
        ${textarea('notes', 'Review notes', submission.review?.notes || '')}
        <div class="notice is-quiet">Choose "Needs follow-up" when the doctor should correct or add information. The doctor will be able to edit and resubmit the form.</div>
        <div class="toolbar">
          <button class="primary-btn" type="submit">Update review</button>
          <button class="secondary-btn" type="button" data-action="archive-record">Archive record</button>
        </div>
      </form>
    </div>
  ` : '';
  const doctorTools = canEditFollowUp ? `
    <div class="record-section">
      <h3>Update requested</h3>
      <div class="notice">A reviewer requested an update. Open the form, edit the information, and submit it back for review.</div>
      <button class="primary-btn" type="button" data-action="edit-follow-up">Edit requested form</button>
    </div>
  ` : '';

  return `
    <div class="panel-header">
      <div>
        <h2>${escapeHtml(submission.candidate.fullName)}</h2>
        <div class="muted">${escapeHtml(submission.id)}</div>
      </div>
      ${can(PERMISSIONS.SUBMISSIONS_DOWNLOAD) ? `<a class="secondary-btn" href="/submissions/${encodeURIComponent(submission.id)}/download">Download PDF</a>` : ''}
    </div>
    <div class="panel-body">
      ${recordSection('Candidate', [
        ['Candidate profile ID', submission.candidate.candidateId],
        ['Full name', submission.candidate.fullName],
        ['Employee/applicant ID', submission.candidate.employeeId],
        ['National ID/TRN', submission.candidate.nationalId],
        ['Date of birth', submission.candidate.dateOfBirth],
        ['Email', submission.candidate.email],
        ['Contact number', submission.candidate.contactNumber],
        ['Position', submission.candidate.position]
      ])}
      ${recordSection('Assessment', [
        ['Facility', submission.assessment.facilityName],
        ['Facility address', submission.assessment.facilityAddress],
        ['Assessment date', submission.assessment.assessmentDate],
        ['Clinician', submission.assessment.clinicianName],
        ['Registration number', submission.assessment.clinicianRegistrationNumber]
      ])}
      ${recordSection('Vitals', [
        ['Height', submission.vitals.heightCm],
        ['Weight', submission.vitals.weightKg],
        ['Blood pressure', submission.vitals.bloodPressure],
        ['Pulse', submission.vitals.pulse],
        ['Vision', submission.vitals.vision],
        ['Hearing', submission.vitals.hearing],
        ['Urine', submission.vitals.urine]
      ])}
      ${recordSection('Medical history', [
        ['Selected history', historySummary(submission.medicalHistory)],
        ['Notes', submission.medicalHistory.notes]
      ])}
      ${recordSection('Family history', [
        ['Selected family history', familyHistorySummary(submission.familyHistory || submission.patientCaseData?.familyHistory || {})],
        ['Notes', submission.familyHistory?.notes || submission.patientCaseData?.familyHistory?.notes]
      ])}
      ${recordSection('Physical examination', [
        ['General appearance', submission.physicalExam.generalAppearance || submission.physicalExam.general],
        ['Height', submission.physicalExam.height || submission.vitals?.heightCm],
        ['Weight', submission.physicalExam.weight || submission.vitals?.weightKg],
        ['Nose', submission.physicalExam.nose],
        ['Pharynx', submission.physicalExam.pharynx],
        ['Teeth', submission.physicalExam.teeth],
        ['Tongue', submission.physicalExam.tongue],
        ['Tonsils', submission.physicalExam.tonsils],
        ['Thyroid', submission.physicalExam.thyroid],
        ['Pulse rate', submission.physicalExam.pulseRate || submission.vitals?.pulse],
        ['Rhythm', submission.physicalExam.rhythm],
        ['Blood pressure', submission.physicalExam.bloodPressure || submission.vitals?.bloodPressure],
        ['Varicose veins', submission.physicalExam.varicoseVeins],
        ['Presence of cyanosis', submission.physicalExam.presenceOfCyanosis],
        ['Mucus membrane', submission.physicalExam.mucusMembrane],
        ['Thorax', submission.physicalExam.thorax || submission.physicalExam.respiratory],
        ['Breasts', submission.physicalExam.breasts],
        ['Fundi', submission.physicalExam.fundi || submission.physicalExam.nervousSystem],
        ['Reflexes', submission.physicalExam.reflexes],
        ['Sensation', submission.physicalExam.sensation],
        ['Tremors', submission.physicalExam.tremors],
        ['Mental appearance', submission.physicalExam.mentalAppearance],
        ['Behaviour', submission.physicalExam.behaviour],
        ['Kidneys', submission.physicalExam.kidneys],
        ['Organs', submission.physicalExam.organs],
        ['Skull', submission.physicalExam.skull || submission.physicalExam.musculoskeletal],
        ['Spine', submission.physicalExam.spine],
        ['Upper extremities', submission.physicalExam.upperExtremities],
        ['Lower extremities', submission.physicalExam.lowerExtremities],
        ['Disabilities', submission.physicalExam.disabilities || submission.physicalExam.comments],
        ['Pregnancy test', submission.physicalExam.pregnancyTest]
      ])}
      ${recordSection('Tests', [
        ['Laboratory', submission.labResults.additionalTests || submission.labResults.otherTests]
      ])}
      ${recordSection('Determination', [
        ['Status', statusLabels[submission.determination.status]],
        ['Conclusions', submission.determination.conclusions],
        ['Restrictions', submission.determination.restrictions],
        ['Recommendation', submission.determination.recommendation],
        ['Follow-up date', submission.determination.followUpDate]
      ])}
      ${recordSection('Attestation', [
        ['Signed by', submission.attestation.signedBy],
        ['Signature date', submission.attestation.signatureDate],
        ['Submitted by', submission.submittedByName]
      ])}
      ${reviewerTools}
      ${doctorTools}
    </div>
  `;
}

function renderHrReviewQueue() {
  const selectedCase = state.selectedReviewCaseId
    ? (state.cases || []).find((medicalCase) => medicalCase.id === state.selectedReviewCaseId)
    : null;
  if (selectedCase) return renderHrReviewWorkspace(selectedCase);

  const cases = filteredHrReviewCases();
  const agedCount = cases.filter((medicalCase) => Number(daysBetween(medicalCase.submittedAt || medicalCase.updatedAt || medicalCase.createdAt, new Date().toISOString())) >= 3).length;
  return `
    <div class="admin-grid review-queue-grid">
      <section class="panel review-queue-panel">
        <div class="panel-header review-queue-header">
          <div>
            <h2>HR review queue</h2>
            <div class="muted">Doctor-submitted medicals ready for HR review.</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" type="button" data-action="refresh-review-queue">Refresh</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="review-queue-summary">
            ${reviewQueueMetric('Ready for review', cases.length)}
            ${reviewQueueMetric('Aged 3+ days', agedCount)}
            ${reviewQueueMetric('With PDF', cases.filter((medicalCase) => medicalCase.submissionId).length)}
          </div>
          <div class="field inline-filter">
            <label class="sr-only" for="reviewQueueSearch">Search HR review queue</label>
            <input id="reviewQueueSearch" type="search" value="${escapeHtml(state.reviewQueueSearch)}" placeholder="Search patient, case ID, medical office, applicant ID">
          </div>
          ${state.reviewQueueMessage ? `<div class="notice is-quiet" role="status">${escapeHtml(state.reviewQueueMessage)}</div>` : ''}
          <div class="user-table review-queue-table" id="reviewQueueTable">
            ${renderHrReviewRows(cases)}
          </div>
        </div>
      </section>
    </div>
  `;
}

function reviewQueueMetric(label, value) {
  return `
    <div class="review-queue-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function filteredHrReviewCases() {
  const query = state.reviewQueueSearch.trim().toLowerCase();
  return (state.cases || [])
    .filter((medicalCase) => medicalCase.status === 'doctor_submitted')
    .filter((medicalCase) => !query || [
      medicalCase.patientName,
      medicalCase.patientEmail,
      medicalCase.employeeId,
      medicalCase.assignedClinicianName,
      medicalCase.id,
      caseStageLabel(medicalCase)
    ].join(' ').toLowerCase().includes(query))
    .sort((left, right) => (left.submittedAt || left.updatedAt || '').localeCompare(right.submittedAt || right.updatedAt || ''));
}

function renderHrReviewRows(cases) {
  if (!state.reviewQueueLoaded) return '<div class="empty">Loading HR review queue.</div>';
  if (!cases.length) return '<div class="empty">No doctor-submitted medicals are waiting for HR review.</div>';
  return `
    <div class="user-row user-row-head review-queue-row">
      <strong>Patient</strong>
      <strong>Medical office</strong>
      <strong>Submitted</strong>
      <strong>Billing</strong>
      <strong>Action</strong>
    </div>
    ${cases.map((medicalCase) => `
      <div class="user-row review-queue-row">
        <div>
          <span>${escapeHtml(medicalCase.patientName || 'Patient')}</span>
          <div class="muted">${escapeHtml(medicalCase.employeeId || medicalCase.id)}</div>
        </div>
        <span>${escapeHtml(officeForCase(medicalCase)?.name || medicalCase.assignedClinicianName || 'Unassigned')}</span>
        <span>${escapeHtml(formatDateTime(medicalCase.submittedAt || medicalCase.updatedAt))}</span>
        <span>${escapeHtml(paymentStatusLabel(doctorPaymentStatus(medicalCase)))}</span>
        <div class="table-actions">
          <button class="secondary-btn compact-primary" type="button" data-open-review-case="${escapeHtml(medicalCase.id)}">Review medical</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderHrReviewWorkspace(medicalCase) {
  const patientData = medicalCase.patientCaseData || {};
  const submission = state.reviewQueueSubmissionId === medicalCase.submissionId ? state.reviewQueueSubmission : null;
  const canExport = Boolean(medicalCase.submissionId);
  return `
    <div class="admin-grid">
      <section class="panel review-workspace-panel">
        <div class="panel-header patient-detail-header case-workspace-header">
          <div>
            <button class="text-btn patient-back-btn" type="button" data-action="back-to-review-queue">Back to review queue</button>
            <h2>${escapeHtml(medicalCase.patientName || 'Medical case')}</h2>
            <div class="muted">${escapeHtml(medicalCase.id)} | HR review</div>
          </div>
          <div class="header-actions">
            ${canExport ? `<a class="secondary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/print" target="_blank" rel="noopener">Export current PDF</a>` : '<button class="secondary-btn compact-primary" type="button" disabled>PDF unavailable</button>'}
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="case-workspace-strip review-workspace-strip">
            ${caseWorkspacePill('Status', caseStatusLabels[medicalCase.status] || medicalCase.status)}
            ${caseWorkspacePill('Stage', caseStageLabel(medicalCase))}
            ${caseWorkspacePill('Billing', paymentStatusLabel(doctorPaymentStatus(medicalCase)))}
            ${caseWorkspacePill('Submitted', formatDateTime(medicalCase.submittedAt || medicalCase.updatedAt))}
          </div>

          <div id="hrReviewTabs" class="case-workspace-tabs review-tabs">
            <div class="tab-list case-tab-list" role="tablist" aria-label="HR medical review sections">
              ${['Patient information', 'Doctor assessment', 'Documents', 'Complete review'].map((label, index) => `
                <button class="tab-button ${index === 0 ? 'is-active' : ''}" type="button" data-tab="${index}">${escapeHtml(label)}</button>
              `).join('')}
            </div>
            <section class="tab-panel is-active" data-tab-panel="0">
              ${recordSection('Patient profile', patientProfileRows(medicalCase))}
              ${recordSection('Personal and consent', patientPersonalRows(patientData, medicalCase))}
              ${renderCustomFieldRecordSection('Patient additional fields', 'patient', patientData.customFields)}
              ${renderPatientFamilyHistory(patientData)}
              ${renderPatientMedicalHistory(patientData, medicalCase)}
            </section>
            <section class="tab-panel" data-tab-panel="1">
              ${submission ? renderSubmissionAssessment(submission) : '<div class="empty">Loading doctor assessment, or the assessment is not linked to this case yet.</div>'}
              ${!submission && medicalCase.doctorDraft ? renderDoctorDraftSnapshot(medicalCase.doctorDraft) : ''}
              ${renderCustomFieldRecordSection('Doctor additional fields', 'doctor', submission?.customFields || medicalCase.doctorDraft?.customFields)}
              ${recordSection('Doctor activity', doctorAssessmentSummaryRows(medicalCase))}
            </section>
            <section class="tab-panel" data-tab-panel="2">
              ${renderCaseDocuments(medicalCase, submission)}
            </section>
            <section class="tab-panel" data-tab-panel="3">
              <form id="hrReviewCompleteForm" class="review-complete-panel form-stack" data-case-id="${escapeHtml(medicalCase.id)}">
                <div>
                  <h3>Complete HR review</h3>
                  <p class="muted">Completing review moves this medical out of the HR action queue and places it in billing as unpaid.</p>
                </div>
                <div class="grid-3">
                  ${readonlyField('Next case status', 'Reviewed')}
                  ${readonlyField('Billing status', 'Unpaid')}
                  ${field('payableAmount', 'Payable amount', 'number', false, medicalCase.payableAmount || reportCaseAmount(medicalCase) || '')}
                </div>
                ${textarea('reviewNotes', 'HR review notes', '')}
                <div class="toolbar">
                  <button class="primary-btn compact-primary" type="submit">Complete review</button>
                  ${canExport ? `<a class="secondary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/print" target="_blank" rel="noopener">Export PDF</a>` : ''}
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>
    </div>
  `;
}

async function bindHrReviewQueue() {
  if (!state.reviewQueueLoaded) loadHrReviewQueueData();

  document.querySelector('[data-action="refresh-review-queue"]')?.addEventListener('click', async () => {
    state.reviewQueueLoaded = false;
    await loadHrReviewQueueData();
    renderContent();
  });

  document.querySelector('#reviewQueueSearch')?.addEventListener('input', (event) => {
    state.reviewQueueSearch = event.currentTarget.value;
    const table = document.querySelector('#reviewQueueTable');
    if (table) table.innerHTML = renderHrReviewRows(filteredHrReviewCases());
    bindHrReviewRows();
  });

  document.querySelector('[data-action="back-to-review-queue"]')?.addEventListener('click', () => {
    state.selectedReviewCaseId = '';
    state.reviewQueueSubmission = null;
    state.reviewQueueSubmissionId = '';
    renderContent();
  });

  const tabs = document.querySelector('#hrReviewTabs');
  if (tabs) bindTabs(tabs);

  const selectedCase = state.selectedReviewCaseId
    ? (state.cases || []).find((medicalCase) => medicalCase.id === state.selectedReviewCaseId)
    : null;
  if (selectedCase?.submissionId && state.reviewQueueSubmissionId !== selectedCase.submissionId) {
    loadHrReviewSubmission(selectedCase);
  }

  document.querySelector('#hrReviewCompleteForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const selectedCase = (state.cases || []).find((medicalCase) => medicalCase.id === form.dataset.caseId);
      if (selectedCase?.submissionId) {
        await api(`/api/submissions/${encodeURIComponent(selectedCase.submissionId)}/review`, {
          method: 'PATCH',
          body: {
            status: 'reviewed',
            notes: data.get('reviewNotes')
          }
        });
      }
      await api(`/api/cases/${encodeURIComponent(form.dataset.caseId)}`, {
        method: 'PATCH',
        body: {
          status: 'reviewed',
          paymentStatus: 'unpaid',
          payableAmount: data.get('payableAmount')
        }
      });
      state.reviewQueueMessage = 'Medical reviewed and moved to billing as unpaid.';
      state.selectedReviewCaseId = '';
      state.reviewQueueSubmission = null;
      state.reviewQueueSubmissionId = '';
      state.reviewQueueLoaded = false;
      await loadHrReviewQueueData();
      renderContent();
    } finally {
      button.disabled = false;
    }
  });

  bindHrReviewRows();
}

function bindHrReviewRows() {
  document.querySelectorAll('[data-open-review-case]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedReviewCaseId = button.dataset.openReviewCase;
      state.reviewQueueSubmission = null;
      state.reviewQueueSubmissionId = '';
      state.reviewQueueMessage = '';
      renderContent();
    });
  });
}

async function loadHrReviewQueueData() {
  const [casesResponse, cliniciansResponse, officeResponse] = await Promise.all([
    api('/api/cases'),
    api('/api/setup/clinicians'),
    api('/api/medical-offices').catch(() => ({ offices: [] }))
  ]);
  state.cases = casesResponse.cases || [];
  state.clinicians = cliniciansResponse.clinicians || [];
  state.medicalOffices = officeResponse.offices || [];
  state.reviewQueueLoaded = true;
  if (state.view === 'review') {
    renderContent();
    return;
  }
  const table = document.querySelector('#reviewQueueTable');
  if (table) {
    table.innerHTML = renderHrReviewRows(filteredHrReviewCases());
    bindHrReviewRows();
  }
}

async function loadHrReviewSubmission(medicalCase) {
  try {
    const response = await api(`/api/submissions/${encodeURIComponent(medicalCase.submissionId)}`);
    state.reviewQueueSubmission = response.submission || null;
    state.reviewQueueSubmissionId = medicalCase.submissionId;
    if (state.view === 'review' && state.selectedReviewCaseId === medicalCase.id) renderContent();
  } catch {
    state.reviewQueueSubmission = null;
    state.reviewQueueSubmissionId = medicalCase.submissionId;
  }
}

function recordSection(title, rows) {
  return `
    <div class="record-section">
      <h3>${escapeHtml(title)}</h3>
      <dl class="kv">
        ${rows.map(([label, value]) => `
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value || 'Not recorded')}</dd>
        `).join('')}
      </dl>
    </div>
  `;
}

function renderAdmin() {
  return `
    <div class="admin-workspace">
      <section class="panel admin-console">
        <div class="panel-header">
          <div>
            <h2>Administration</h2>
            <div class="muted">Manage workflow forms, system branding, notification routing, and user access.</div>
          </div>
        </div>
        <div class="admin-module-tabs" role="tablist" aria-label="Administration sections">
          ${adminModuleButton('forms', 'Form Management')}
          ${adminModuleButton('system', 'System Settings')}
          ${adminModuleButton('notifications', 'Notification Settings')}
          ${adminModuleButton('users', 'User Access')}
          ${adminModuleButton('audit', 'Audit Trail')}
        </div>
      </section>

      <section class="panel admin-module-panel" data-admin-panel="forms" ${state.adminModule === 'forms' ? '' : 'hidden'}>
        <div class="panel-header">
          <div>
            <h2>Form Management</h2>
            <div class="muted">Configure process tabs, fields, visibility, editability, and required rules.</div>
          </div>
          <button class="secondary-btn compact-primary" type="button" data-action="reset-form-template">Reset default</button>
        </div>
        <div class="panel-body form-stack">
          <div id="formManagementDesigner">${renderFormManagementDesigner()}</div>
          <div id="formBuilderMessage" class="notice is-quiet" role="status"></div>
        </div>
      </section>

      <section class="panel admin-module-panel" data-admin-panel="system" ${state.adminModule === 'system' ? '' : 'hidden'}>
        <div class="panel-header">
          <div>
            <h2>System Settings</h2>
            <div class="muted">Manage branding, authentication, mail delivery, security limits, logs, and schedules.</div>
          </div>
        </div>
        <div class="panel-body">
          ${renderSystemSettingsConsole()}
        </div>
      </section>

      <section class="panel admin-module-panel" data-admin-panel="notifications" ${state.adminModule === 'notifications' ? '' : 'hidden'}>
        <div class="panel-header">
          <div>
            <h2>Notification Settings</h2>
            <div class="muted">Reviewer alerts are used when doctors submit forms. Doctor notification copies are used when new hires are assigned.</div>
          </div>
        </div>
        <div class="panel-body">
          <form id="notificationSettingsForm" class="grid-2">
            ${field('notificationEmail', 'Reviewer notification email(s)', 'text', false, state.settings.notificationEmail || '')}
            ${field('doctorNotificationEmail', 'Doctor notification copy email(s)', 'text', false, state.settings.doctorNotificationEmail || '')}
            <button class="primary-btn" type="submit">Save notification emails</button>
          </form>
          <div id="notificationSettingsMessage" class="notice is-quiet setup-message" role="status"></div>
        </div>
      </section>

      <section class="panel admin-module-panel" data-admin-panel="users" ${state.adminModule === 'users' ? '' : 'hidden'}>
        <div class="panel-header">
          <div>
            <h2>User access</h2>
            <div class="muted">Add medical facilities, HR reviewers, and administrators.</div>
          </div>
          <button class="secondary-btn" data-action="refresh-users">Refresh</button>
        </div>
        <div class="panel-body form-stack">
          <form id="userForm" class="compact-form">
            ${field('email', 'Email', 'email', true)}
            ${field('displayName', 'Display name', 'text', true)}
            <div class="field">
              <label for="role">Role</label>
              <select id="role" name="role" required>
                <option value="clinician">Medical office user</option>
                <option value="reviewer">HR reviewer/officer</option>
                <option value="patient">Patient</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            ${field('password', 'Temporary password', 'password', true)}
            <button class="primary-btn" type="submit">Create user</button>
          </form>
          <div id="userMessage" class="notice is-quiet" role="status"></div>
          <div class="user-table" id="userTable">
            ${renderUserRows()}
          </div>
        </div>
      </section>

      <section class="panel admin-module-panel" data-admin-panel="audit" ${state.adminModule === 'audit' ? '' : 'hidden'}>
        <div class="panel-header">
          <div>
            <h2>Audit Trail</h2>
            <div class="muted">Track case, billing, user, notification, and settings activity.</div>
          </div>
          <button class="secondary-btn" type="button" data-action="refresh-audit">Refresh</button>
        </div>
        <div class="panel-body">
          <div class="user-table audit-table" id="auditTable">${renderAuditRows()}</div>
        </div>
      </section>
    </div>
  `;
}

function adminModuleButton(id, label) {
  return `<button class="admin-module-tab ${state.adminModule === id ? 'is-active' : ''}" type="button" data-admin-module="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function renderSystemSettingsConsole() {
  return `
    <form id="settingsForm" class="system-settings-console">
      <div class="system-settings-tabs" role="tablist" aria-label="System settings sections">
        ${systemSettingsTabButton('general', 'General')}
        ${systemSettingsTabButton('theme', 'Theme')}
        ${systemSettingsTabButton('auth', 'Authentication')}
        ${systemSettingsTabButton('mail', 'Mail')}
        ${systemSettingsTabButton('database', 'Database')}
        ${systemSettingsTabButton('operations', 'Operations')}
      </div>
      <div class="system-settings-grid">
        ${renderSystemSettingsPanel('general', renderGeneralSettingsPanel())}
        ${renderSystemSettingsPanel('theme', renderThemeSettingsPanel())}
        ${renderSystemSettingsPanel('auth', renderAuthSettingsPanel())}
        ${renderSystemSettingsPanel('mail', renderMailSettingsPanel())}
        ${renderSystemSettingsPanel('database', renderDatabaseSettingsPanel())}
        ${renderSystemSettingsPanel('operations', renderOperationsSettingsPanel())}
      </div>
      <div id="settingsMessage" class="settings-alert" role="status" aria-live="polite"></div>
      <div class="settings-footer">
        <span class="muted">Settings are stored securely in the local application data folder.</span>
        <button class="primary-btn compact-primary" type="submit">Save system settings</button>
      </div>
    </form>
  `;
}

function systemSettingsTabButton(id, label) {
  return `<button class="system-settings-tab ${state.systemSettingsTab === id ? 'is-active' : ''}" type="button" data-system-settings-tab="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function renderSystemSettingsPanel(id, content) {
  return `<section class="system-settings-panel" data-system-settings-panel="${escapeHtml(id)}" ${state.systemSettingsTab === id ? '' : 'hidden'}>${content}</section>`;
}

function renderGeneralSettingsPanel() {
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <h3>General</h3>
        <span>Portal identity and core copy</span>
      </div>
      <div class="settings-form-grid">
        ${field('organizationName', 'Organization name', 'text', true, state.settings.organizationName)}
        ${field('appName', 'Portal name', 'text', true, state.settings.appName)}
        ${field('supportContact', 'Support contact', 'text', false, state.settings.supportContact)}
      </div>
      <div class="branding-upload-grid">
        ${logoUploadField('smallLogoDataUrl', 'Small sidebar icon', state.settings.smallLogoDataUrl, 'Best for the collapsed rail. Use a square PNG, JPG, SVG, or WebP.')}
        ${logoUploadField('largeLogoDataUrl', 'Large portal icon', state.settings.largeLogoDataUrl, 'Best for login and expanded branding. PNG, JPG, SVG, or WebP.')}
      </div>
      <div class="settings-form-grid is-single">
        ${textarea('clinicianIntro', 'Doctor page message', state.settings.clinicianIntro)}
        ${textarea('reviewerIntro', 'Reviewer page message', state.settings.reviewerIntro)}
        ${textarea('confidentialityNotice', 'Confidentiality notice', state.settings.confidentialityNotice)}
      </div>
    </div>
  `;
}

function renderThemeSettingsPanel() {
  const colors = state.settings.themeColors || {};
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <h3>Theme</h3>
        <span>Control the main system colors and interface tokens</span>
      </div>
      <div class="settings-color-grid">
        ${colorSetting('themeColors.background', 'App background', colors.background)}
        ${colorSetting('themeColors.surface', 'Panels and cards', colors.surface)}
        ${colorSetting('themeColors.secondarySurface', 'Selected states', colors.secondarySurface)}
        ${colorSetting('themeColors.text', 'Primary text', colors.text)}
        ${colorSetting('themeColors.mutedText', 'Muted text', colors.mutedText)}
        ${colorSetting('themeColors.border', 'Borders', colors.border)}
        ${colorSetting('themeColors.primary', 'Primary actions', colors.primary || state.settings.primaryColor)}
        ${colorSetting('themeColors.accent', 'Accent color', colors.accent || state.settings.accentColor)}
        ${colorSetting('themeColors.danger', 'Danger state', colors.danger)}
      </div>
      <input name="primaryColor" type="hidden" value="${escapeHtml(colors.primary || state.settings.primaryColor)}">
      <input name="accentColor" type="hidden" value="${escapeHtml(colors.accent || state.settings.accentColor)}">
    </div>
  `;
}

function renderAuthSettingsPanel() {
  const auth = state.settings.auth || {};
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <h3>Authentication</h3>
        <span>Local accounts remain available. Add LDAP and SAML as additional sign-in providers.</span>
      </div>
      <input name="auth.mode" type="hidden" value="local">
      <div class="settings-provider-strip">
        <div class="settings-provider-pill is-fixed">
          <strong>Local accounts</strong>
          <span>Always available</span>
        </div>
        ${settingsCheck('auth.ldapEnabled', 'LDAP', auth.ldapEnabled)}
        ${settingsCheck('auth.samlEnabled', 'SAML', auth.samlEnabled)}
      </div>
      <div class="settings-split">
        <div class="settings-subcard">
          <h4>LDAP</h4>
          ${field('auth.ldapUrl', 'LDAP URL', 'text', false, auth.ldapUrl || '')}
          ${field('auth.ldapBaseDn', 'Base DN', 'text', false, auth.ldapBaseDn || '')}
          ${field('auth.ldapBindDn', 'Bind DN', 'text', false, auth.ldapBindDn || '')}
          ${field('auth.ldapUserFilter', 'User filter', 'text', false, auth.ldapUserFilter || '')}
        </div>
        <div class="settings-subcard">
          <h4>SAML</h4>
          ${field('auth.samlEntryPoint', 'Identity provider SSO URL', 'text', false, auth.samlEntryPoint || '')}
          ${field('auth.samlIssuer', 'Service provider issuer', 'text', false, auth.samlIssuer || '')}
          ${textarea('auth.samlCertificate', 'X.509 certificate', auth.samlCertificate || '')}
        </div>
      </div>
    </div>
  `;
}

function renderMailSettingsPanel() {
  const mail = state.settings.mail || {};
  const templates = state.settings.emailTemplates || {};
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <h3>Mail and notifications</h3>
        <span>SMTP settings feed reviewer, doctor, and assignment notifications</span>
      </div>
      <div class="settings-form-grid">
        ${field('notificationEmail', 'Reviewer notification email(s)', 'text', false, state.settings.notificationEmail || '')}
        ${field('doctorNotificationEmail', 'Doctor notification copy email(s)', 'text', false, state.settings.doctorNotificationEmail || '')}
        ${field('mail.fromEmail', 'From email', 'email', false, mail.fromEmail || '')}
        ${settingsCheck('mail.enabled', 'Use saved SMTP settings', mail.enabled)}
      </div>
      <div class="settings-form-grid">
        ${field('mail.host', 'SMTP host', 'text', false, mail.host || '')}
        ${field('mail.port', 'SMTP port', 'number', false, mail.port || 587)}
        ${field('mail.username', 'SMTP username', 'text', false, mail.username || '')}
        ${field('mail.password', 'SMTP password', 'password', false, mail.password || '')}
        ${settingsCheck('mail.secure', 'Use SMTPS', mail.secure)}
        ${settingsCheck('mail.rejectUnauthorized', 'Verify TLS certificate', mail.rejectUnauthorized !== false)}
      </div>
      <div class="settings-mail-test">
        ${field('mailTestRecipient', 'Test recipient', 'email', false, state.user?.email || '')}
        <button class="secondary-btn compact-primary" type="button" data-action="test-mail-server">Send test email</button>
      </div>
      <div class="settings-subcard email-template-settings">
        <h4>Email templates</h4>
        <div class="field-help">Available placeholders include {{appName}}, {{displayName}}, {{email}}, {{loginUrl}}, {{temporaryPassword}}, {{resetUrl}}, and {{expiryMinutes}}.</div>
        ${emailTemplateFields('accountCreated', 'Account created', templates.accountCreated)}
        ${emailTemplateFields('passwordReset', 'Password reset', templates.passwordReset)}
        ${emailTemplateFields('medicalAssignedToPatient', 'Medical assigned to patient', templates.medicalAssignedToPatient)}
      </div>
    </div>
  `;
}

function emailTemplateFields(key, label, template = {}) {
  return `
    <details class="email-template-editor">
      <summary>${escapeHtml(label)}</summary>
      ${field(`emailTemplates.${key}.subject`, 'Subject', 'text', true, template.subject || '')}
      ${textarea(`emailTemplates.${key}.body`, 'Message', template.body || '')}
    </details>
  `;
}

function renderOperationsSettingsPanel() {
  const operations = state.settings.operations || {};
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <h3>Operations</h3>
        <span>Security limits, audit retention, logs, and scheduled work</span>
      </div>
      <div class="settings-form-grid">
        ${field('operations.sessionTimeoutMinutes', 'Session timeout minutes', 'number', true, operations.sessionTimeoutMinutes || 15)}
        ${field('operations.loginMaxAttempts', 'Login max attempts', 'number', true, operations.loginMaxAttempts || 5)}
        ${field('operations.loginWindowMinutes', 'Login window minutes', 'number', true, operations.loginWindowMinutes || 15)}
        ${field('operations.rateLimitPerMinute', 'API rate limit per minute', 'number', true, operations.rateLimitPerMinute || 120)}
        ${field('operations.auditRetentionDays', 'Audit retention days', 'number', true, operations.auditRetentionDays || 365)}
        ${field('operations.dailyDigestTime', 'Daily digest time', 'time', false, operations.dailyDigestTime || '08:00')}
        ${field('operations.timezone', 'Timezone', 'text', false, operations.timezone || 'America/Jamaica')}
      </div>
    </div>
  `;
}

function renderDatabaseSettingsPanel() {
  const database = state.settings.database || {};
  const status = state.databaseStatus;
  const environmentSource = database.source !== 'settings';
  const enabled = environmentSource ? Boolean(status?.enabled) : database.enabled;
  const provider = environmentSource && status?.provider ? status.provider : database.provider;
  return `
    <div class="settings-section-card">
      <div class="settings-section-head">
        <div>
          <h3>Database</h3>
          <span>Use environment variables or encrypted administrator-managed connection settings</span>
        </div>
        <span class="plain-status ${status?.enabled ? 'is-active' : 'is-inactive'}" data-database-status>${status?.enabled ? `${escapeHtml(status.dialect || 'Database')} schema ready` : 'Not connected'}</span>
      </div>
      <div class="settings-form-grid">
        <div class="field">
          <label for="databaseSource">Configuration source</label>
          <select id="databaseSource" name="database.source">
            <option value="environment" ${environmentSource ? 'selected' : ''}>Environment variables</option>
            <option value="settings" ${!environmentSource ? 'selected' : ''}>Encrypted system settings</option>
          </select>
        </div>
        ${settingsCheck('database.enabled', 'Enable database connection', enabled)}
        <div class="field">
          <label for="databaseProvider">Database type</label>
          <select id="databaseProvider" name="database.provider">
            ${[
              ['postgres', 'PostgreSQL'],
              ['mysql', 'MySQL'],
              ['mariadb', 'MariaDB'],
              ['cloudsql', 'Google Cloud SQL']
            ].map(([value, label]) => `<option value="${value}" ${provider === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="field" data-cloudsql-field>
          <label for="cloudSqlDialect">Cloud SQL engine</label>
          <select id="cloudSqlDialect" name="database.cloudSqlDialect">
            <option value="postgres" ${database.cloudSqlDialect !== 'mysql' ? 'selected' : ''}>PostgreSQL</option>
            <option value="mysql" ${database.cloudSqlDialect === 'mysql' ? 'selected' : ''}>MySQL</option>
          </select>
        </div>
      </div>
      <div class="settings-subcard database-managed-fields" data-database-managed-fields>
        <div class="settings-form-grid">
          ${field('database.host', 'Database host', 'text', false, database.host || '127.0.0.1')}
          ${field('database.port', 'Port', 'number', false, database.port || 5432)}
          ${field('database.database', 'Database name', 'text', false, database.database || 'ncb_medical')}
          ${field('database.user', 'Database user', 'text', false, database.user || '')}
          ${field('database.password', 'Database password', 'password', false, database.password || '')}
          ${field('database.socketPath', 'Unix socket path', 'text', false, database.socketPath || '')}
          <div class="field">
            <label for="databaseSslMode">TLS mode</label>
            <select id="databaseSslMode" name="database.sslMode">
              <option value="require" ${database.sslMode === 'require' ? 'selected' : ''}>Require and verify TLS</option>
              <option value="no-verify" ${database.sslMode === 'no-verify' ? 'selected' : ''}>Require without certificate verification</option>
              <option value="disable" ${database.sslMode === 'disable' ? 'selected' : ''}>Disable TLS</option>
            </select>
          </div>
          ${settingsCheck('database.autoMigrate', 'Run migrations automatically', database.autoMigrate !== false)}
          ${settingsCheck('database.autoCreate', 'Create database if missing', database.autoCreate)}
        </div>
        <details class="settings-advanced">
          <summary>Certificates and connection pool</summary>
          <div class="settings-form-grid">
            ${textarea('database.sslCa', 'TLS CA certificate', database.sslCa || '')}
            ${textarea('database.sslCert', 'TLS client certificate', database.sslCert || '')}
            ${textarea('database.sslKey', 'TLS private key', database.sslKey || '')}
            ${field('database.poolMin', 'Minimum connections', 'number', false, database.poolMin ?? 0)}
            ${field('database.poolMax', 'Maximum connections', 'number', false, database.poolMax || 10)}
            ${field('database.connectTimeoutMs', 'Connect timeout (ms)', 'number', false, database.connectTimeoutMs || 10000)}
            ${field('database.idleTimeoutMs', 'Idle timeout (ms)', 'number', false, database.idleTimeoutMs || 30000)}
            ${field('database.statementTimeoutMs', 'Statement timeout (ms)', 'number', false, database.statementTimeoutMs || 30000)}
          </div>
        </details>
      </div>
      <div class="notice is-quiet" data-database-source-note>
        ${environmentSource
          ? 'Environment variables are authoritative. Secrets are not displayed or copied into system settings.'
          : 'Passwords and TLS private keys are encrypted with the application master key before being stored.'}
      </div>
      ${status?.enabled ? `
        <div class="notice is-quiet">
          The SQL schema is ready. Current application records still use encrypted file storage until the repository cutover is completed.
        </div>
      ` : ''}
      <div class="settings-mail-test database-actions">
        <button class="secondary-btn compact-primary" type="button" data-action="test-database">Test connection</button>
        <button class="primary-btn compact-primary" type="button" data-action="save-database">Save and connect</button>
      </div>
    </div>
  `;
}

function colorSetting(name, label, value = '') {
  return `
    <label class="color-setting">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="color" value="${escapeHtml(value || '#000000')}">
    </label>
  `;
}

function settingsCheck(name, label, checked = false) {
  return `<label class="settings-check"><input name="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''}> <span>${escapeHtml(label)}</span></label>`;
}

function renderFormManagementDesigner() {
  ensureFormDesignerSelection();
  const template = currentFormTemplate();
  const selectedStep = stepById(state.formBuilderSelectedStepId) || template.processSteps[0];
  const fields = template.fields.filter((field) => field.stepId === selectedStep?.id);
  const selectedField = fields.find((field) => field.id === state.formBuilderSelectedFieldId) || fields[0];
  if (selectedField) state.formBuilderSelectedFieldId = selectedField.id;
  return `
    <div class="designer-shell">
      <aside class="designer-task-panel" aria-label="Process tasks">
        <div class="designer-panel-title">
          <strong>Process tabs</strong>
          <span>${template.processSteps.length} tabs</span>
        </div>
        <div class="designer-task-list">
          ${template.processSteps.map((step) => {
            const stepFields = template.fields.filter((field) => field.stepId === step.id);
            return `
              <button class="designer-task ${state.formBuilderSelectedStepId === step.id ? 'is-active' : ''}" type="button" draggable="true" data-designer-step-row="${escapeHtml(step.id)}" data-select-process-step="${escapeHtml(step.id)}">
                <span class="designer-drag-handle" aria-hidden="true">::</span>
                <span>
                  <strong>${escapeHtml(step.label)}</strong>
                  <small>${escapeHtml(surfaceLabel(step.surface))} | ${stepFields.length} fields</small>
                </span>
                <span class="designer-state-pill ${step.active !== false ? 'is-live' : 'is-muted'}">${step.active !== false ? 'Active' : 'Hidden'}</span>
              </button>
            `;
          }).join('')}
        </div>
        <form id="newProcessStepForm" class="designer-add-form">
          <strong>Add process tab</strong>
          ${field('label', 'Task/tab name', 'text', true)}
          <div class="field">
            <label for="stepSurface">Primary user type</label>
            <select id="stepSurface" name="surface" required>
              <option value="hr">HR Officer</option>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          ${textarea('description', 'Task description')}
          <button class="primary-btn" type="submit">Add task</button>
        </form>
      </aside>

      <div class="designer-main">
        ${selectedStep ? renderSelectedTaskEditor(selectedStep, fields, selectedField) : '<div class="empty">Add a task to begin designing the process.</div>'}
      </div>
    </div>
  `;
}

function renderSelectedTaskEditor(step, fields, selectedField) {
  return `
    <div class="designer-task-editor">
      <form id="selectedProcessStepForm" class="designer-step-card" data-process-step-id="${escapeHtml(step.id)}">
        <div class="designer-step-heading">
          <div>
            <h3>${escapeHtml(step.label)}</h3>
            <div class="muted">${escapeHtml(step.description || 'No description recorded.')}</div>
          </div>
          <div class="toolbar">
            <button class="secondary-btn" type="submit">Save task</button>
            ${step.builtIn ? '' : '<button class="danger-btn secondary-btn" type="button" data-action="delete-selected-process-step">Delete task</button>'}
          </div>
        </div>
        <div class="grid-2">
          ${field('label', 'Task/tab label', 'text', true, step.label)}
          <div class="field">
            <label for="selectedStepSurface">Primary user type</label>
            <select id="selectedStepSurface" name="surface">
              ${['hr', 'patient', 'doctor'].map((surface) => `<option value="${escapeHtml(surface)}" ${step.surface === surface ? 'selected' : ''}>${escapeHtml(surfaceLabel(surface))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="designer-permission-strip">
          <span><strong>Visible</strong> ${escapeHtml(defaultRolesForSurface(step.surface).map(roleLabel).join(', '))}</span>
          <span><strong>Editable</strong> ${escapeHtml(defaultRolesForSurface(step.surface).map(roleLabel).join(', '))}</span>
          <label class="check"><input name="active" type="checkbox" ${step.active !== false ? 'checked' : ''}> <span>Task is active</span></label>
        </div>
        ${textarea('description', 'Description', step.description || '')}
      </form>

      <div class="designer-fields-card">
        <div class="designer-step-heading">
          <div>
            <h3>Fields on this tab</h3>
            <div class="muted">${escapeHtml(fields.length)} fields. Select one to manage rules.</div>
          </div>
        </div>
        <div class="designer-field-table">
          ${renderDesignerFieldRows(fields)}
        </div>
        <form id="newFormFieldForm" class="designer-add-field">
          <strong>Add field to ${escapeHtml(step.label)}</strong>
          <input type="hidden" name="stepId" value="${escapeHtml(step.id)}">
          ${field('section', 'Section', 'text', true)}
          ${field('label', 'Field label', 'text', true)}
          <div class="field">
            <label for="builderType">Field type</label>
            <select id="builderType" name="type" required>
              ${configurableFieldTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(fieldTypeLabel(type))}</option>`).join('')}
            </select>
          </div>
          ${textarea('options', 'Options or display text')}
          <button class="primary-btn" type="submit">Add field</button>
        </form>
      </div>

      ${renderFieldDetailPanel(selectedField)}
    </div>
  `;
}

function renderDesignerFieldRows(fields) {
  if (!fields.length) return '<div class="empty">No fields are assigned to this task yet.</div>';
  return `
    <div class="designer-field-row designer-field-head">
      <strong>Field</strong>
      <strong>Type</strong>
      <strong>Visible</strong>
      <strong>Editable</strong>
      <strong>Required</strong>
      <strong>Status</strong>
    </div>
    ${fields.map((fieldConfig) => `
      <button class="designer-field-row ${state.formBuilderSelectedFieldId === fieldConfig.id ? 'is-active' : ''}" type="button" draggable="true" data-designer-field-row="${escapeHtml(fieldConfig.id)}" data-select-form-field="${escapeHtml(fieldConfig.id)}">
        <span class="designer-field-name"><span class="designer-drag-handle" aria-hidden="true">::</span><span><strong>${escapeHtml(fieldConfig.label)}</strong><small>${escapeHtml(fieldConfig.section || 'General')}</small></span></span>
        <span class="designer-type-pill">${escapeHtml(fieldTypeLabel(fieldConfig.type))}</span>
        <span class="designer-role-summary">${escapeHtml(roleSummary(fieldConfig.visibleRoles))}</span>
        <span class="designer-role-summary">${escapeHtml(roleSummary(fieldConfig.editableRoles))}</span>
        <span class="designer-role-summary">${escapeHtml(roleSummary(fieldConfig.requiredRoles))}</span>
        <span class="designer-state-pill ${fieldConfig.active !== false ? 'is-live' : 'is-muted'}">${fieldConfig.active !== false ? 'Shown' : 'Hidden'}</span>
      </button>
    `).join('')}
  `;
}

function renderFieldDetailPanel(item) {
  if (!item) return '<div class="designer-field-detail empty">Select or add a field to manage details.</div>';
  return `
    <form class="designer-field-detail" id="fieldDetailForm" data-form-field-id="${escapeHtml(item.id)}">
      <div class="designer-step-heading">
        <div>
          <h3>Field details</h3>
          <div class="muted">${item.builtIn ? `System field: ${escapeHtml(item.name)}` : 'Custom field'}</div>
        </div>
        <div class="toolbar">
          <button class="secondary-btn" type="submit">Save field</button>
          ${item.builtIn ? '' : '<button class="danger-btn secondary-btn" type="button" data-action="delete-selected-form-field">Delete field</button>'}
        </div>
      </div>
      <div class="grid-2">
        ${field('label', 'Field label', 'text', true, item.label)}
        ${field('section', 'Section', 'text', true, item.section)}
        <div class="field">
          <label for="detailStepId">Task/tab</label>
          <select id="detailStepId" name="stepId">
            ${stepOptions(item.stepId)}
          </select>
        </div>
        <div class="field">
          <label for="detailType">Field type</label>
          <select id="detailType" name="type">
            ${configurableFieldTypes.map((type) => `<option value="${escapeHtml(type)}" ${item.type === type ? 'selected' : ''}>${escapeHtml(fieldTypeLabel(type))}</option>`).join('')}
          </select>
        </div>
      </div>
      <label class="check"><input name="active" type="checkbox" ${item.active !== false ? 'checked' : ''}> <span>Show field</span></label>
      <div class="designer-role-grid">
        ${roleChecklist('visibleRoles', 'Visible to', item.visibleRoles)}
        ${roleChecklist('editableRoles', 'Editable by', item.editableRoles)}
        ${roleChecklist('requiredRoles', 'Required for', item.requiredRoles)}
      </div>
      ${textarea('options', 'Options or display text', (item.options || []).join('\n'))}
    </form>
  `;
}

function ensureFormDesignerSelection() {
  const template = currentFormTemplate();
  const steps = template.processSteps;
  if (!steps.some((step) => step.id === state.formBuilderSelectedStepId)) {
    state.formBuilderSelectedStepId = steps.find((step) => step.active !== false)?.id || steps[0]?.id || '';
  }
  const fields = template.fields.filter((field) => field.stepId === state.formBuilderSelectedStepId);
  if (!fields.some((field) => field.id === state.formBuilderSelectedFieldId)) {
    state.formBuilderSelectedFieldId = fields[0]?.id || '';
  }
}

function fieldTypeLabel(type) {
  return {
    text: 'Simple text box',
    textarea: 'Comment box',
    date: 'Date',
    number: 'Number',
    email: 'Email',
    phone: 'Phone',
    select: 'Dropdown',
    radio: 'Radio buttons',
    checkbox: 'Checkbox',
    yes_no: 'Yes/No',
    information: 'Information / disclosure'
  }[type] || type;
}

function roleSummary(roles = []) {
  if (!roles?.length) return 'None';
  return roles.map(roleLabel).join(', ');
}

function bindAdmin() {
  loadAdminData();

  bindAdminModuleTabs();
  bindSystemSettingsTabs();
  bindMailTestAction();
  bindDatabaseSettings();

  document.querySelector('#settingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('#settingsMessage');
    message.textContent = '';
    try {
      const data = new FormData(form);
      const smallLogoDataUrl = await resolveLogoField(form, 'smallLogoDataUrl');
      const largeLogoDataUrl = await resolveLogoField(form, 'largeLogoDataUrl');
      const response = await api('/api/admin/settings', {
        method: 'PUT',
        body: buildSettingsPayload(data, smallLogoDataUrl, largeLogoDataUrl)
      });
      state.settings = { ...state.settings, ...response.settings };
      applyTheme();
      setSettingsMessage(message, 'System settings saved.', 'success');
    } catch (err) {
      setSettingsMessage(message, err.message, 'error');
    }
  });

  document.querySelector('#userForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#userMessage');
    message.textContent = '';
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          email: data.get('email'),
          displayName: data.get('displayName'),
          role: data.get('role'),
          password: data.get('password')
        }
      });
      form.reset();
      message.textContent = 'User created.';
      await loadAdminUsers();
    } catch (err) {
      message.textContent = err.message;
    }
  });

  document.querySelector('[data-action="refresh-users"]')?.addEventListener('click', loadAdminUsers);
  document.querySelector('[data-action="refresh-audit"]')?.addEventListener('click', loadAuditEntries);
  bindFormBuilder();
  bindLogoUploadControls();
}

function bindMailTestAction() {
  document.querySelector('[data-action="test-mail-server"]')?.addEventListener('click', async (event) => {
    const form = document.querySelector('#settingsForm');
    const message = document.querySelector('#settingsMessage');
    const button = event.currentTarget;
    const recipient = form?.elements.mailTestRecipient?.value || state.user?.email || '';
    if (!recipient) {
      setSettingsMessage(message, 'Enter a test recipient email address.', 'error');
      return;
    }
    button.disabled = true;
    setSettingsMessage(message, 'Testing mail server...', 'info');
    try {
      const data = new FormData(form);
      const response = await api('/api/admin/mail-test', {
        method: 'POST',
        body: {
          recipient,
          settings: buildMailTestPayload(data)
        }
      });
      setSettingsMessage(message, response.message || 'Test email sent.', 'success');
    } catch (err) {
      const routeMissing = String(err.message || '').toLowerCase().includes('api route not found');
      setSettingsMessage(message, routeMissing ? 'Mail test route is not loaded yet. Restart the Node server, then try again.' : err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function bindDatabaseSettings() {
  const form = document.querySelector('#settingsForm');
  const source = form?.elements['database.source'];
  const enabledControl = form?.elements['database.enabled'];
  const provider = form?.elements['database.provider'];
  const managedFields = form?.querySelector('[data-database-managed-fields]');
  const sourceNote = form?.querySelector('[data-database-source-note]');
  const cloudSqlField = form?.querySelector('[data-cloudsql-field]');
  if (!form || !source || !provider) return;

  const refresh = () => {
    const usesSettings = source.value === 'settings';
    ['database.provider', 'database.cloudSqlDialect'].forEach((name) => {
      if (form.elements[name]) form.elements[name].disabled = !usesSettings;
    });
    if (managedFields) {
      managedFields.classList.toggle('is-disabled', !usesSettings);
      managedFields.querySelectorAll('input, select, textarea').forEach((control) => {
        control.disabled = !usesSettings;
      });
    }
    if (sourceNote) {
      sourceNote.textContent = usesSettings
        ? 'Passwords and TLS private keys are encrypted with the application master key before being stored.'
        : 'Environment variables are authoritative. Secrets are not displayed or copied into system settings.';
    }
    if (cloudSqlField) cloudSqlField.hidden = provider.value !== 'cloudsql';
  };
  enabledControl?.addEventListener('change', () => {
    if (enabledControl.checked && source.value === 'environment') {
      source.value = 'settings';
      refresh();
    }
  });
  source.addEventListener('change', refresh);
  provider.addEventListener('change', refresh);
  refresh();

  document.querySelector('[data-action="test-database"]')?.addEventListener('click', async (event) => {
    const message = document.querySelector('#settingsMessage');
    const button = event.currentTarget;
    button.disabled = true;
    setSettingsMessage(message, 'Testing database connection...', 'info');
    try {
      const response = await api('/api/admin/database-test', {
        method: 'POST',
        body: { database: buildDatabaseSettingsPayload(new FormData(form)) }
      });
      setSettingsMessage(message, response.message || 'Database connection succeeded.', 'success');
    } catch (err) {
      setSettingsMessage(message, err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('[data-action="save-database"]')?.addEventListener('click', async (event) => {
    const message = document.querySelector('#settingsMessage');
    const button = event.currentTarget;
    button.disabled = true;
    setSettingsMessage(message, 'Validating and applying database configuration...', 'info');
    try {
      const response = await api('/api/admin/database-config', {
        method: 'PUT',
        body: { database: buildDatabaseSettingsPayload(new FormData(form)) }
      });
      state.settings = { ...state.settings, ...response.settings };
      state.databaseStatus = response.status || null;
      const status = document.querySelector('[data-database-status]');
      if (status) {
        status.className = `plain-status ${state.databaseStatus?.enabled ? 'is-active' : 'is-inactive'}`;
        status.textContent = state.databaseStatus?.enabled ? `${state.databaseStatus.dialect || 'Database'} schema ready` : 'Not connected';
      }
      setSettingsMessage(message, response.message || 'Database configuration saved.', 'success');
    } catch (err) {
      setSettingsMessage(message, err.message, 'error');
      button.disabled = false;
    }
  });
}

function buildDatabaseSettingsPayload(data) {
  return {
    source: data.get('database.source'),
    enabled: data.has('database.enabled'),
    provider: data.get('database.provider'),
    cloudSqlDialect: data.get('database.cloudSqlDialect') || 'postgres',
    host: data.get('database.host'),
    port: data.get('database.port'),
    database: data.get('database.database'),
    user: data.get('database.user'),
    password: data.get('database.password'),
    socketPath: data.get('database.socketPath'),
    sslMode: data.get('database.sslMode'),
    sslCa: data.get('database.sslCa'),
    sslCert: data.get('database.sslCert'),
    sslKey: data.get('database.sslKey'),
    autoMigrate: data.has('database.autoMigrate'),
    autoCreate: data.has('database.autoCreate'),
    poolMin: data.get('database.poolMin'),
    poolMax: data.get('database.poolMax'),
    connectTimeoutMs: data.get('database.connectTimeoutMs'),
    idleTimeoutMs: data.get('database.idleTimeoutMs'),
    statementTimeoutMs: data.get('database.statementTimeoutMs')
  };
}

function buildMailTestPayload(data) {
  return {
    appName: state.settings.appName,
    mail: {
      enabled: data.has('mail.enabled') || Boolean(data.get('mail.host')),
      host: data.get('mail.host'),
      port: data.get('mail.port'),
      secure: data.has('mail.secure'),
      rejectUnauthorized: data.has('mail.rejectUnauthorized'),
      username: data.get('mail.username'),
      password: data.get('mail.password'),
      fromEmail: data.get('mail.fromEmail')
    }
  };
}

function bindAdminModuleTabs() {
  document.querySelectorAll('[data-admin-module]').forEach((button) => {
    button.addEventListener('click', () => {
      state.adminModule = button.dataset.adminModule;
      document.querySelectorAll('[data-admin-module]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.adminPanel !== state.adminModule;
      });
      if (state.adminModule === 'audit') loadAuditEntries();
    });
  });
}

function bindSystemSettingsTabs() {
  document.querySelectorAll('[data-system-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.systemSettingsTab = button.dataset.systemSettingsTab;
      document.querySelectorAll('[data-system-settings-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-system-settings-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.systemSettingsPanel !== state.systemSettingsTab;
      });
    });
  });
}

function buildSettingsPayload(data, smallLogoDataUrl, largeLogoDataUrl) {
  return {
    organizationName: data.get('organizationName'),
    appName: data.get('appName'),
    notificationEmail: data.get('notificationEmail'),
    doctorNotificationEmail: data.get('doctorNotificationEmail'),
    supportContact: data.get('supportContact'),
    primaryColor: data.get('themeColors.primary') || data.get('primaryColor'),
    accentColor: data.get('themeColors.accent') || data.get('accentColor'),
    themeColors: {
      background: data.get('themeColors.background'),
      surface: data.get('themeColors.surface'),
      secondarySurface: data.get('themeColors.secondarySurface'),
      text: data.get('themeColors.text'),
      mutedText: data.get('themeColors.mutedText'),
      border: data.get('themeColors.border'),
      primary: data.get('themeColors.primary'),
      accent: data.get('themeColors.accent'),
      danger: data.get('themeColors.danger')
    },
    smallLogoDataUrl,
    largeLogoDataUrl,
    clinicianIntro: data.get('clinicianIntro'),
    reviewerIntro: data.get('reviewerIntro'),
    confidentialityNotice: data.get('confidentialityNotice'),
    auth: {
      mode: data.get('auth.mode'),
      ldapEnabled: data.has('auth.ldapEnabled'),
      ldapUrl: data.get('auth.ldapUrl'),
      ldapBaseDn: data.get('auth.ldapBaseDn'),
      ldapBindDn: data.get('auth.ldapBindDn'),
      ldapUserFilter: data.get('auth.ldapUserFilter'),
      samlEnabled: data.has('auth.samlEnabled'),
      samlEntryPoint: data.get('auth.samlEntryPoint'),
      samlIssuer: data.get('auth.samlIssuer'),
      samlCertificate: data.get('auth.samlCertificate')
    },
    mail: {
      enabled: data.has('mail.enabled') || Boolean(data.get('mail.host')),
      host: data.get('mail.host'),
      port: data.get('mail.port'),
      secure: data.has('mail.secure'),
      rejectUnauthorized: data.has('mail.rejectUnauthorized'),
      username: data.get('mail.username'),
      password: data.get('mail.password'),
      fromEmail: data.get('mail.fromEmail')
    },
    emailTemplates: {
      accountCreated: collect(data, 'emailTemplates.accountCreated', ['subject', 'body']),
      passwordReset: collect(data, 'emailTemplates.passwordReset', ['subject', 'body']),
      medicalAssignedToPatient: collect(data, 'emailTemplates.medicalAssignedToPatient', ['subject', 'body'])
    },
    operations: {
      sessionTimeoutMinutes: data.get('operations.sessionTimeoutMinutes'),
      loginMaxAttempts: data.get('operations.loginMaxAttempts'),
      loginWindowMinutes: data.get('operations.loginWindowMinutes'),
      rateLimitPerMinute: data.get('operations.rateLimitPerMinute'),
      auditRetentionDays: data.get('operations.auditRetentionDays'),
      dailyDigestTime: data.get('operations.dailyDigestTime'),
      timezone: data.get('operations.timezone')
    },
    formTemplate: currentFormTemplate()
  };
}

function setSettingsMessage(element, message, tone = 'success') {
  if (!element) return;
  element.textContent = message;
  element.className = `settings-alert is-${tone}`;
}

async function loadAdminData() {
  const [settingsResponse, databaseStatus] = await Promise.all([
    api('/api/admin/settings'),
    api('/api/admin/database-status').catch(() => null),
    loadAdminUsers()
  ]);
  state.settings = { ...state.settings, ...settingsResponse.settings };
  state.databaseStatus = databaseStatus;
  if (databaseStatus?.source && state.settings.database) state.settings.database.source = databaseStatus.source;
  applyTheme();
  populateSettingsForm();
  refreshFormManagementDesigner();
  if (state.adminModule === 'audit') await loadAuditEntries();
  const table = document.querySelector('#formBuilderTable');
  if (table) {
    table.innerHTML = renderFormBuilderRows();
    bindFormBuilderRows();
  }
  const stepTable = document.querySelector('#processStepTable');
  if (stepTable) {
    stepTable.innerHTML = renderProcessStepRows();
    bindProcessStepRows();
  }
}

async function loadAuditEntries() {
  const response = await api('/api/admin/audit');
  state.auditEntries = response.entries || [];
  const table = document.querySelector('#auditTable');
  if (table) table.innerHTML = renderAuditRows();
}

function renderAuditRows() {
  if (!state.auditEntries.length) return '<div class="empty">No audit entries recorded yet.</div>';
  return `
    <div class="user-row user-row-head audit-row">
      <strong>When</strong>
      <strong>Action</strong>
      <strong>User</strong>
      <strong>Details</strong>
    </div>
    ${state.auditEntries.map((entry) => `
      <div class="user-row audit-row">
        <span class="audit-time">${escapeHtml(formatDateTime(entry.ts))}</span>
        <span><strong>${escapeHtml(auditEventLabel(entry.event))}</strong><small>${escapeHtml(entry.event || '')}</small></span>
        <span>${escapeHtml(entry.userId || entry.targetUserId || 'System')}</span>
        <span class="audit-details">${escapeHtml(auditDetails(entry))}</span>
      </div>
    `).join('')}
  `;
}

function auditEventLabel(event) {
  return String(event || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function auditDetails(entry) {
  const hidden = new Set(['ts', 'event', 'userId']);
  return Object.entries(entry || {})
    .filter(([key, value]) => !hidden.has(key) && value !== undefined && value !== '')
    .map(([key, value]) => `${auditKeyLabel(key)}: ${formatAuditValue(value)}`)
    .join('  ');
}

function auditKeyLabel(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditValue(value) {
  if (value === null) return 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function populateSettingsForm() {
  const form = document.querySelector('#settingsForm');
  if (!form) return;
  populateSettingsFormValues(form, state.settings);
}

function populateSettingsFormValues(form, source, prefix = '') {
  Object.entries(source || {}).forEach(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      populateSettingsFormValues(form, value, name);
      return;
    }
    const control = form.elements[name];
    if (!control) return;
    if (control.type === 'checkbox') {
      control.checked = Boolean(value);
      return;
    }
    control.value = value ?? '';
  });
}

function renderFormBuilderRows() {
  const rows = currentFormTemplate().fields;
  const steps = new Map(currentFormTemplate().processSteps.map((step) => [step.id, step]));
  if (!rows.length) return '<div class="empty">No fields configured.</div>';
  return `
    <div class="form-builder-row form-builder-head">
      <strong>Field</strong>
      <strong>Rules</strong>
      <strong>Step & options</strong>
      <strong>Action</strong>
    </div>
    ${rows.map((item) => `
      <form class="form-builder-row" data-form-field-id="${escapeHtml(item.id)}">
        <div class="form-stack">
          <span class="status">${escapeHtml(steps.get(item.stepId)?.label || item.surface)}</span>
          ${field('label', 'Label', 'text', true, item.label)}
          ${field('section', 'Section', 'text', true, item.section)}
          <div class="muted">${item.builtIn ? `System field: ${escapeHtml(item.name)}` : 'Custom field'}</div>
        </div>
        <div class="form-stack">
          <label class="check"><input name="active" type="checkbox" ${item.active !== false ? 'checked' : ''}> <span>Show field</span></label>
          ${roleChecklist('visibleRoles', 'Visible to', item.visibleRoles)}
          ${roleChecklist('editableRoles', 'Editable by', item.editableRoles)}
          ${roleChecklist('requiredRoles', 'Required for', item.requiredRoles)}
        </div>
        <div class="form-stack">
          <div class="field">
            <label for="step-${escapeHtml(item.id)}">Process step</label>
            <select id="step-${escapeHtml(item.id)}" name="stepId">
              ${stepOptions(item.stepId)}
            </select>
          </div>
          <div class="field">
            <label for="type-${escapeHtml(item.id)}">Type</label>
            <select id="type-${escapeHtml(item.id)}" name="type">
              ${configurableFieldTypes.map((type) => `<option value="${escapeHtml(type)}" ${item.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
            </select>
          </div>
          ${textarea('options', 'Options', (item.options || []).join('\n'))}
        </div>
        <div class="toolbar">
          <button class="secondary-btn" type="submit">Save</button>
          ${item.builtIn ? '' : '<button class="danger-btn secondary-btn" type="button" data-action="delete-form-field">Delete</button>'}
        </div>
      </form>
    `).join('')}
  `;
}

function renderProcessStepRows() {
  const rows = currentFormTemplate().processSteps;
  return `
    <div class="form-builder-row form-builder-head process-step-row">
      <strong>Step</strong>
      <strong>Form</strong>
      <strong>Description</strong>
      <strong>Action</strong>
    </div>
    ${rows.map((step) => `
      <form class="form-builder-row process-step-row" data-process-step-id="${escapeHtml(step.id)}">
        <div class="form-stack">
          ${field('label', 'Step name', 'text', true, step.label)}
          <div class="muted">${step.builtIn ? 'System workflow step' : 'Custom workflow step'}</div>
          <label class="check"><input name="active" type="checkbox" ${step.active !== false ? 'checked' : ''}> <span>Step is active</span></label>
        </div>
        <div class="field">
          <label for="surface-${escapeHtml(step.id)}">Primary form</label>
          <select id="surface-${escapeHtml(step.id)}" name="surface">
            ${['hr', 'patient', 'doctor'].map((surface) => `<option value="${escapeHtml(surface)}" ${step.surface === surface ? 'selected' : ''}>${escapeHtml(surfaceLabel(surface))}</option>`).join('')}
          </select>
        </div>
        ${textarea('description', 'Description', step.description || '')}
        <div class="toolbar">
          <button class="secondary-btn" type="submit">Save</button>
          ${step.builtIn ? '' : '<button class="danger-btn secondary-btn" type="button" data-action="delete-process-step">Delete</button>'}
        </div>
      </form>
    `).join('')}
  `;
}

function stepOptions(selected = '') {
  return currentFormTemplate().processSteps
    .filter((step) => step.active !== false)
    .map((step) => `<option value="${escapeHtml(step.id)}" ${selected === step.id ? 'selected' : ''}>${escapeHtml(step.label)} (${escapeHtml(surfaceLabel(step.surface))})</option>`)
    .join('');
}

function stepById(id) {
  return currentFormTemplate().processSteps.find((step) => step.id === id);
}

function surfaceLabel(surface) {
  return { hr: 'HR Officer', patient: 'Patient', doctor: 'Doctor' }[surface] || surface;
}

function roleChecklist(name, label, selected = []) {
  return `
    <div class="field role-checks">
      <span class="label">${escapeHtml(label)}</span>
      ${formBuilderRoles.map((role) => `
        <label class="check"><input name="${escapeHtml(name)}" value="${escapeHtml(role)}" type="checkbox" ${(selected || []).includes(role) ? 'checked' : ''}> <span>${escapeHtml(roleLabel(role))}</span></label>
      `).join('')}
    </div>
  `;
}

function bindFormBuilder() {
  bindFormManagementDesigner();

  document.querySelectorAll('[data-form-builder-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.formBuilderView;
      document.querySelectorAll('[data-form-builder-view]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-form-builder-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.formBuilderPanel !== view;
      });
    });
  });

  const stepForm = document.querySelector('#newProcessStepForm');
  if (stepForm && !stepForm.dataset.bound) {
    stepForm.dataset.bound = 'true';
    stepForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const template = currentFormTemplate();
      template.processSteps.push({
        id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        builtIn: false,
        active: true,
        label: data.get('label'),
        surface: data.get('surface'),
        description: data.get('description')
      });
      await saveFormTemplate(template, 'Process step added.');
      form.reset();
    });
  }

  const newFieldForm = document.querySelector('#newFormFieldForm');
  if (newFieldForm && !newFieldForm.dataset.bound) {
    newFieldForm.dataset.bound = 'true';
    newFieldForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const template = currentFormTemplate();
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const step = stepById(data.get('stepId')) || defaultProcessSteps()[0];
    template.fields.push({
      id,
      builtIn: false,
      active: true,
      stepId: step.id,
      surface: step.surface,
      section: data.get('section'),
      name: `customFields.${id}`,
      label: data.get('label'),
      type: data.get('type'),
      options: splitOptionLines(data.get('options')),
      visibleRoles: defaultRolesForSurface(step.surface),
      editableRoles: defaultRolesForSurface(step.surface),
      requiredRoles: []
    });
    await saveFormTemplate(template, 'Field added.');
    form.reset();
  });
  }

  bindProcessStepRows();
  bindFormBuilderRows();
  const resetButton = document.querySelector('[data-action="reset-form-template"]');
  if (resetButton && !resetButton.dataset.bound) {
    resetButton.dataset.bound = 'true';
    resetButton.addEventListener('click', async () => {
    if (!window.confirm('Reset the form builder to the NCB default template? Custom fields will be removed.')) return;
    await saveFormTemplate(defaultFormTemplate(), 'Form template reset.');
    });
  }
}

function bindFormManagementDesigner() {
  bindDesignerReorder();

  document.querySelectorAll('[data-select-process-step]').forEach((button) => {
    button.addEventListener('click', () => {
      state.formBuilderSelectedStepId = button.dataset.selectProcessStep;
      state.formBuilderSelectedFieldId = '';
      refreshFormManagementDesigner();
    });
  });

  document.querySelectorAll('[data-select-form-field]').forEach((button) => {
    button.addEventListener('click', () => {
      state.formBuilderSelectedFieldId = button.dataset.selectFormField;
      refreshFormManagementDesigner();
    });
  });

  const selectedStepForm = document.querySelector('#selectedProcessStepForm');
  selectedStepForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const template = currentFormTemplate();
    const step = template.processSteps.find((item) => item.id === form.dataset.processStepId);
    if (!step) return;
    const data = new FormData(form);
    step.active = data.has('active');
    step.label = data.get('label') || step.label;
    step.surface = data.get('surface') || step.surface;
    step.description = data.get('description') || '';
    template.fields.forEach((field) => {
      if (field.stepId === step.id) field.surface = step.surface;
    });
    await saveFormTemplate(template, 'Task saved.');
  });

  document.querySelector('[data-action="delete-selected-process-step"]')?.addEventListener('click', async () => {
    const form = document.querySelector('#selectedProcessStepForm');
    if (!form || !window.confirm('Delete this workflow task? Its fields will be moved to the first default task.')) return;
    const template = currentFormTemplate();
    const fallback = defaultProcessSteps()[0].id;
    template.processSteps = template.processSteps.filter((step) => step.id !== form.dataset.processStepId || step.builtIn);
    template.fields.forEach((field) => {
      if (field.stepId === form.dataset.processStepId) {
        field.stepId = fallback;
        field.surface = stepById(fallback)?.surface || field.surface;
      }
    });
    state.formBuilderSelectedStepId = fallback;
    state.formBuilderSelectedFieldId = '';
    await saveFormTemplate(template, 'Task deleted.');
  });

  const fieldDetailForm = document.querySelector('#fieldDetailForm');
  fieldDetailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const template = currentFormTemplate();
    const item = template.fields.find((field) => field.id === form.dataset.formFieldId);
    if (!item) return;
    const data = new FormData(form);
    item.active = data.has('active');
    item.label = data.get('label') || item.label;
    item.section = data.get('section') || item.section;
    item.stepId = data.get('stepId') || item.stepId || defaultStepForSurface(item.surface);
    item.surface = stepById(item.stepId)?.surface || item.surface;
    item.type = data.get('type') || item.type;
    item.options = splitOptionLines(data.get('options'));
    item.visibleRoles = data.getAll('visibleRoles');
    item.editableRoles = data.getAll('editableRoles');
    item.requiredRoles = data.getAll('requiredRoles');
    state.formBuilderSelectedStepId = item.stepId;
    state.formBuilderSelectedFieldId = item.id;
    await saveFormTemplate(template, 'Field saved.');
  });

  document.querySelector('[data-action="delete-selected-form-field"]')?.addEventListener('click', async () => {
    const form = document.querySelector('#fieldDetailForm');
    if (!form || !window.confirm('Delete this field?')) return;
    const template = currentFormTemplate();
    template.fields = template.fields.filter((field) => field.id !== form.dataset.formFieldId || field.builtIn);
    state.formBuilderSelectedFieldId = '';
    await saveFormTemplate(template, 'Field deleted.');
  });
}

function bindDesignerReorder() {
  document.querySelectorAll('[data-designer-step-row]').forEach((row) => {
    row.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `step:${row.dataset.designerStepRow}`);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      row.classList.remove('is-drop-target');
      const [kind, sourceId] = String(event.dataTransfer.getData('text/plain') || '').split(':');
      if (kind !== 'step' || !sourceId || sourceId === row.dataset.designerStepRow) return;
      const template = currentFormTemplate();
      template.processSteps = moveItemBefore(template.processSteps, sourceId, row.dataset.designerStepRow);
      state.formBuilderSelectedStepId = sourceId;
      await saveFormTemplate(template, 'Process tabs reordered.');
    });
  });

  document.querySelectorAll('[data-designer-field-row]').forEach((row) => {
    row.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `field:${row.dataset.designerFieldRow}`);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      row.classList.remove('is-drop-target');
      const [kind, sourceId] = String(event.dataTransfer.getData('text/plain') || '').split(':');
      if (kind !== 'field' || !sourceId || sourceId === row.dataset.designerFieldRow) return;
      const template = currentFormTemplate();
      template.fields = moveFieldBefore(template.fields, sourceId, row.dataset.designerFieldRow, state.formBuilderSelectedStepId);
      state.formBuilderSelectedFieldId = sourceId;
      await saveFormTemplate(template, 'Fields reordered.');
    });
  });
}

function moveItemBefore(items, sourceId, targetId) {
  const rows = [...items];
  const sourceIndex = rows.findIndex((item) => item.id === sourceId);
  const targetIndex = rows.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return rows;
  const [source] = rows.splice(sourceIndex, 1);
  const nextTargetIndex = rows.findIndex((item) => item.id === targetId);
  rows.splice(nextTargetIndex, 0, source);
  return rows;
}

function moveFieldBefore(fields, sourceId, targetId, stepId) {
  const selected = fields.filter((field) => field.stepId === stepId);
  if (!selected.some((field) => field.id === sourceId) || !selected.some((field) => field.id === targetId)) return fields;
  const reordered = moveItemBefore(selected, sourceId, targetId);
  let cursor = 0;
  return fields.map((field) => field.stepId === stepId ? reordered[cursor++] : field);
}

function refreshFormManagementDesigner() {
  const designer = document.querySelector('#formManagementDesigner');
  if (!designer) return;
  designer.innerHTML = renderFormManagementDesigner();
  bindFormBuilder();
}

function bindFormBuilderRows() {
  document.querySelectorAll('[data-form-field-id]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const template = currentFormTemplate();
      const item = template.fields.find((field) => field.id === form.dataset.formFieldId);
      if (!item) return;
      const data = new FormData(form);
      item.active = data.has('active');
      item.label = data.get('label') || item.label;
      item.section = data.get('section') || item.section;
      item.stepId = data.get('stepId') || item.stepId || defaultStepForSurface(item.surface);
      item.surface = stepById(item.stepId)?.surface || item.surface;
      item.type = data.get('type') || item.type;
      item.options = splitOptionLines(data.get('options'));
      item.visibleRoles = data.getAll('visibleRoles');
      item.editableRoles = data.getAll('editableRoles');
      item.requiredRoles = data.getAll('requiredRoles');
      await saveFormTemplate(template, 'Field rules saved.');
    });
  });

  document.querySelectorAll('[data-action="delete-form-field"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const form = button.closest('[data-form-field-id]');
      const template = currentFormTemplate();
      template.fields = template.fields.filter((field) => field.id !== form.dataset.formFieldId || field.builtIn);
      await saveFormTemplate(template, 'Field deleted.');
    });
  });
}

function bindProcessStepRows() {
  document.querySelectorAll('[data-process-step-id]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const template = currentFormTemplate();
      const step = template.processSteps.find((item) => item.id === form.dataset.processStepId);
      if (!step) return;
      const data = new FormData(form);
      step.active = data.has('active');
      step.label = data.get('label') || step.label;
      step.surface = data.get('surface') || step.surface;
      step.description = data.get('description') || '';
      template.fields.forEach((field) => {
        if (field.stepId === step.id) field.surface = step.surface;
      });
      await saveFormTemplate(template, 'Process step saved.');
    });
  });

  document.querySelectorAll('[data-action="delete-process-step"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const form = button.closest('[data-process-step-id]');
      const template = currentFormTemplate();
      const fallback = defaultProcessSteps()[0].id;
      template.processSteps = template.processSteps.filter((step) => step.id !== form.dataset.processStepId || step.builtIn);
      template.fields.forEach((field) => {
        if (field.stepId === form.dataset.processStepId) field.stepId = fallback;
      });
      await saveFormTemplate(template, 'Process step deleted.');
    });
  });
}

async function saveFormTemplate(template, messageText) {
  const response = await api('/api/admin/form-template', {
    method: 'PUT',
    body: { formTemplate: template }
  });
  state.settings.formTemplate = response.formTemplate;
  const message = document.querySelector('#formBuilderMessage');
  if (message) message.textContent = messageText;
  refreshFormManagementDesigner();
  const table = document.querySelector('#formBuilderTable');
  if (table) table.innerHTML = renderFormBuilderRows();
  const stepTable = document.querySelector('#processStepTable');
  if (stepTable) stepTable.innerHTML = renderProcessStepRows();
  bindFormBuilderRows();
  bindProcessStepRows();
}

function defaultRolesForSurface(surface) {
  if (surface === 'doctor') return ['admin', 'clinician'];
  if (surface === 'patient') return ['admin', 'patient'];
  return ['admin', 'reviewer'];
}

function splitOptionLines(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bindLogoUploadControls() {
  document.querySelectorAll('[data-logo-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const fieldName = input.dataset.logoInput;
      const preview = document.querySelector(`[data-logo-preview="${fieldName}"]`);
      const hidden = document.querySelector(`[name="${fieldName}"]`);
      if (!input.files?.[0]) return;
      try {
        const dataUrl = await readImageFileAsDataUrl(input.files[0]);
        hidden.value = dataUrl;
        preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="">`;
      } catch (err) {
        input.value = '';
        alert(err.message);
      }
    });
  });
  document.querySelectorAll('[data-logo-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      const fieldName = button.dataset.logoClear;
      const hidden = document.querySelector(`[name="${fieldName}"]`);
      const input = document.querySelector(`[data-logo-input="${fieldName}"]`);
      const preview = document.querySelector(`[data-logo-preview="${fieldName}"]`);
      hidden.value = '';
      if (input) input.value = '';
      if (preview) preview.innerHTML = '<span>NCB</span>';
    });
  });
}

async function resolveLogoField(form, name) {
  const input = form.querySelector(`[data-logo-input="${name}"]`);
  if (input?.files?.[0]) return readImageFileAsDataUrl(input.files[0]);
  return form.elements[name]?.value || '';
}

function readImageFileAsDataUrl(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return Promise.reject(new Error('Logo must be a PNG, JPG, SVG, or WebP image.'));
  }
  if (file.size > 220 * 1024) {
    return Promise.reject(new Error('Logo image must be 220 KB or smaller.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('Logo could not be read.')));
    reader.readAsDataURL(file);
  });
}

async function loadAdminUsers() {
  const response = await api('/api/admin/users');
  state.users = response.users || [];
  const table = document.querySelector('#userTable');
  if (table) {
    table.innerHTML = renderUserRows();
    bindUserRows();
  }
}

function renderUserRows() {
  if (!state.users.length) return '<div class="empty">No users loaded.</div>';
  return `
    <div class="user-row user-row-head">
      <strong>Name</strong>
      <strong>Role</strong>
      <strong>Status</strong>
      <strong>Action</strong>
    </div>
    ${state.users.map((user) => `
      <form class="user-row" data-user-id="${escapeHtml(user.id)}">
        <div>
          <strong>${escapeHtml(user.displayName)}</strong>
          <div class="muted">${escapeHtml(user.email)}</div>
        </div>
        <div class="field">
          <label class="sr-only" for="role-${escapeHtml(user.id)}">Role</label>
          <select id="role-${escapeHtml(user.id)}" name="role">
            ${Object.values(ROLES).map((role) => `
              <option value="${role}" ${user.role === role ? 'selected' : ''}>${escapeHtml(roleLabel(role))}</option>
            `).join('')}
          </select>
        </div>
        <label class="check compact-check">
          <input name="active" type="checkbox" ${user.active ? 'checked' : ''} ${user.id === state.user.id ? 'disabled' : ''}>
          <span>${user.active ? 'Active' : 'Inactive'}</span>
        </label>
        <div class="user-actions">
          <input name="password" type="password" placeholder="New password">
          <button class="secondary-btn" type="submit">Save</button>
        </div>
      </form>
    `).join('')}
  `;
}

function bindUserRows() {
  document.querySelectorAll('[data-user-id]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const body = {
        role: data.get('role'),
        active: data.has('active')
      };
      if (data.get('password')) body.password = data.get('password');
      await api(`/api/admin/users/${encodeURIComponent(form.dataset.userId)}`, {
        method: 'PATCH',
        body
      });
      await loadAdminUsers();
    });
  });
}

function renderPatientManagement() {
  const patients = filteredManagedPatients();
  const patient = selectedManagedPatient();
  const cases = patient ? patientMedicalCases(patient) : [];
  if (patient) {
    return `
      <div class="patient-management-page">
        <section class="panel patient-detail-panel">
          ${renderManagedPatientDetail(patient, cases)}
        </section>
      </div>
      ${renderPatientManagementModal()}
      ${renderDetailModal()}
    `;
  }
  return `
    <div class="patient-management-page">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Patient Management</h2>
            <div class="muted">${patients.length} shown</div>
          </div>
          <button class="secondary-btn" type="button" data-action="refresh-patients">Refresh</button>
        </div>
        <div class="panel-body form-stack">
          <div class="field">
            <label class="sr-only" for="patientManagementSearch">Search patients</label>
            <input id="patientManagementSearch" type="search" value="${escapeHtml(state.patientSearch)}" placeholder="Search by patient, email, applicant ID, TRN, phone">
          </div>
          <div class="user-table patient-management-table" id="patientManagementTable">
            ${renderManagedPatientTable(patients)}
          </div>
        </div>
      </section>
    </div>
    ${renderPatientManagementModal()}
  `;
}

function bindPatientManagement() {
  if (!state.patientManagementLoaded) loadPatientManagementData();
  document.querySelector('[data-action="refresh-patients"]')?.addEventListener('click', async () => {
    state.patientManagementLoaded = false;
    await loadPatientManagementData();
  });
  const searchPatients = debounce(async (query) => {
    const response = await api(`/api/candidates?limit=100&q=${encodeURIComponent(query)}`);
    state.candidates = response.candidates || [];
    const table = document.querySelector('#patientManagementTable');
    if (table) table.innerHTML = renderManagedPatientTable(filteredManagedPatients());
    bindPatientManagementRows();
  }, 250);
  document.querySelector('#patientManagementSearch')?.addEventListener('input', (event) => {
    state.patientSearch = event.currentTarget.value;
    searchPatients(state.patientSearch);
  });
  bindPatientManagementRows();
  document.querySelector('[data-action="back-to-patient-list"]')?.addEventListener('click', () => {
    state.selectedPatientId = '';
    state.patientUserMessage = '';
    renderContent();
  });
  document.querySelector('[data-action="create-medical-for-patient"]')?.addEventListener('click', () => {
    state.prefillPatientId = state.selectedPatientId;
    state.showNewCaseForm = true;
    state.view = 'cases';
    renderShell();
  });
  document.querySelectorAll('[data-open-patient-case-in-cases]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.caseSearch = button.dataset.openPatientCaseInCases;
      state.casePage = 1;
      state.detailModal = null;
      state.view = 'cases';
      renderShell();
      await openCaseWorkspace(button.dataset.openPatientCaseInCases);
    });
  });
  bindPatientManagementModal();
  bindDetailModal();
}

async function loadPatientManagementData(shouldRender = true) {
  const [patientsResponse, casesResponse, usersResponse] = await Promise.all([
    api('/api/candidates?limit=250').catch(() => ({ candidates: [] })),
    api('/api/cases?limit=250').catch(() => ({ cases: [] })),
    api('/api/user-management/users?limit=250').catch(() => ({ users: [] }))
  ]);
  state.candidates = patientsResponse.candidates || [];
  state.cases = casesResponse.cases || [];
  state.users = usersResponse.users || [];
  state.patientManagementLoaded = true;
  if (shouldRender && state.view === 'setup') renderContent();
}

function filteredManagedPatients() {
  const query = state.patientSearch.trim().toLowerCase();
  return (state.candidates || []).filter((patient) => !query || [
    patient.fullName,
    patient.email,
    patient.employeeId,
    patient.nationalId,
    patient.position,
    patient.contactNumber
  ].join(' ').toLowerCase().includes(query));
}

function selectedManagedPatient(patients = state.candidates || []) {
  return patients.find((patient) => patient.id === state.selectedPatientId) || null;
}

function patientUserFor(patient) {
  if (!patient) return null;
  return (state.users || []).find((user) => (
    user.role === ROLES.PATIENT
    && user.active !== false
    && (user.id === patient.linkedUserId || user.email === String(patient.email || '').toLowerCase())
  ));
}

function patientMedicalCases(patient) {
  if (!patient) return [];
  const patientEmail = String(patient.email || '').toLowerCase();
  return (state.cases || [])
    .filter((medicalCase) => medicalCase.patientId === patient.id
      || medicalCase.legacyCandidateId === patient.id
      || (patientEmail && String(medicalCase.patientEmail || '').toLowerCase() === patientEmail))
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

function renderManagedPatientTable(patients) {
  if (!patients.length) return '<div class="empty">No patients match your search.</div>';
  return `
    <div class="user-row user-row-head patient-management-row">
      <strong>Patient</strong>
      <strong>Medicals</strong>
      <strong>Login</strong>
      <strong>Action</strong>
    </div>
    ${patients.map((patient) => {
      const user = patientUserFor(patient);
      return `
        <div class="user-row patient-management-row">
          <div class="managed-user-cell">
            <strong>${escapeHtml(patient.fullName)}</strong>
            <span class="muted">${escapeHtml([patient.employeeId, patient.email || 'No email on profile'].filter(Boolean).join(' | '))}</span>
          </div>
          <span>${patientMedicalCases(patient).length}</span>
          <span class="plain-status ${user ? 'is-active' : 'is-inactive'}">${user ? 'Active' : 'Not created'}</span>
          <div class="table-actions">
            <button class="text-btn" type="button" data-select-patient="${escapeHtml(patient.id)}">Open</button>
            <button class="text-btn" type="button" data-edit-patient="${escapeHtml(patient.id)}">Edit</button>
            ${user ? '' : `<button class="text-btn" type="button" data-create-patient-user="${escapeHtml(patient.id)}">Create user</button>`}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function bindPatientManagementRows() {
  document.querySelectorAll('[data-select-patient]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPatientId = button.dataset.selectPatient;
      state.patientUserMessage = '';
      renderContent();
    });
  });
  document.querySelectorAll('[data-select-patient-login]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPatientId = button.dataset.selectPatientLogin;
      state.patientUserMessage = '';
      renderContent();
    });
  });
  document.querySelectorAll('[data-edit-patient]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingPatientId = button.dataset.editPatient;
      renderContent();
    });
  });
  document.querySelectorAll('[data-create-patient-user]').forEach((button) => {
    button.addEventListener('click', () => {
      openPatientUserCreateFlow(button.dataset.createPatientUser);
    });
  });
}

function openPatientUserCreateFlow(patientId) {
  const patient = (state.candidates || []).find((item) => item.id === patientId);
  if (!patient) return;
  state.managedUserPrefill = {
    patientId: patient.id,
    displayName: patient.fullName || '',
    email: patient.email || '',
    role: ROLES.PATIENT
  };
  state.showCreateManagedUserModal = true;
  state.editingManagedUserId = '';
  state.userManagementMessage = '';
  state.view = 'user-management';
  renderShell();
}

function renderManagedPatientDetail(patient, cases) {
  const user = patientUserFor(patient);
  return `
    <div class="panel-header patient-detail-header">
      <div>
        <button class="text-btn patient-back-btn" type="button" data-action="back-to-patient-list">Back to patients</button>
        <h2>${escapeHtml(patient.fullName)}</h2>
        <div class="muted">${escapeHtml(patient.email || 'No email on profile')}</div>
      </div>
      <div class="header-actions">
        <button class="secondary-btn compact-primary" type="button" data-edit-patient="${escapeHtml(patient.id)}">Edit patient</button>
        ${user ? '' : `<button class="secondary-btn compact-primary" type="button" data-create-patient-user="${escapeHtml(patient.id)}">Create login</button>`}
        <button class="primary-btn compact-primary" type="button" data-action="create-medical-for-patient">New medical</button>
      </div>
    </div>
    <div class="panel-body form-stack">
      <div class="patient-summary-grid">
        ${summaryTile('Applicant ID', patient.employeeId || 'Not recorded')}
        ${summaryTile('TRN / national ID', patient.nationalId || 'Not recorded')}
        ${summaryTile('Date of birth', patient.dateOfBirth || 'Not recorded')}
        ${summaryTile('Phone', patient.contactNumber || 'Not recorded')}
        ${summaryTile('Position', patient.position || 'Not recorded')}
        ${summaryTile('Patient login', user ? 'Active' : 'Not created')}
      </div>

      <div id="patientUserMessage" class="notice is-quiet" role="status">${escapeHtml(state.patientUserMessage)}</div>

      <section class="patient-medical-history">
        <div class="section-heading-row">
          <h3>Medical cases</h3>
          <span>${cases.length} total</span>
        </div>
        <div class="user-table patient-case-table">
          ${renderPatientMedicalHistoryRows(cases)}
        </div>
      </section>
    </div>
  `;
}

function summaryTile(label, value) {
  return `
    <div class="summary-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderPatientManagementEmpty() {
  return `
    <div class="panel-body">
      <div class="empty">Search for and select a patient to view profile details, patient login status, and medical history.</div>
    </div>
  `;
}

function renderPatientMedicalHistoryRows(cases) {
  if (!cases.length) return '<div class="empty">This patient does not have any medical cases yet.</div>';
  return `
    <div class="user-row user-row-head patient-case-row">
      <strong>Medical</strong>
      <strong>Status</strong>
      <strong>Medical office</strong>
      <strong>Action</strong>
    </div>
    ${cases.map((medicalCase) => `
      <div class="user-row patient-case-row">
        <div>
          <strong>${escapeHtml(medicalCase.id)}</strong>
          <div class="muted">${escapeHtml(formatDateTime(medicalCase.createdAt))}</div>
        </div>
        <span>${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status || 'Not recorded')}</span>
        <span>${escapeHtml(medicalCase.assignedClinicianName || 'Unassigned')}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-open-patient-case-in-cases="${escapeHtml(medicalCase.id)}">Open</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderPatientManagementModal() {
  const editingPatient = (state.candidates || []).find((patient) => patient.id === state.editingPatientId);
  if (editingPatient) {
    return `
      <div class="modal-backdrop" data-action="close-patient-management-modal">
        <section class="modal-content managed-user-modal" role="dialog" aria-modal="true" aria-label="Edit patient">
          <div class="managed-modal-header">
            <div class="managed-modal-identity">
              <span class="avatar is-large" aria-hidden="true">${escapeHtml(getInitials(editingPatient.fullName))}</span>
              <div>
                <h2>Edit patient</h2>
                <span>${escapeHtml(editingPatient.fullName)}</span>
              </div>
            </div>
            <button class="icon-close-btn" type="button" data-action="close-patient-management-modal" aria-label="Close">&times;</button>
          </div>
          <form id="patientEditForm" class="managed-user-edit-form" data-patient-id="${escapeHtml(editingPatient.id)}">
            <div class="managed-modal-body">
              <section class="managed-form-section">
                <div class="grid-2">
                  ${field('fullName', 'Full name', 'text', true, editingPatient.fullName)}
                  ${field('employeeId', 'Applicant ID', 'text', false, editingPatient.employeeId || '')}
                  ${field('nationalId', 'TRN / national ID', 'text', false, editingPatient.nationalId || '')}
                  ${field('dateOfBirth', 'Date of birth', 'date', true, editingPatient.dateOfBirth || '')}
                  ${field('email', 'Email', 'email', false, editingPatient.email || '')}
                  ${field('contactNumber', 'Phone number', 'tel', false, editingPatient.contactNumber || '')}
                  ${field('position', 'Position', 'text', true, editingPatient.position || '')}
                  ${field('primaryPhysician', 'Primary physician', 'text', false, editingPatient.primaryPhysician || '')}
                </div>
                ${textarea('address', 'Address', editingPatient.address || '')}
                <div class="grid-2">
                  ${field('emergencyContactName', 'Emergency contact name', 'text', false, editingPatient.emergencyContactName || '')}
                  ${field('emergencyContactNumber', 'Emergency contact phone', 'tel', false, editingPatient.emergencyContactNumber || '')}
                </div>
              </section>
              <div id="patientEditMessage" class="notice is-quiet" role="status"></div>
            </div>
            <div class="managed-modal-footer">
              <button class="secondary-btn" type="button" data-action="close-patient-management-modal">Cancel</button>
              <button class="primary-btn" type="submit">Save patient</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  return '';
}

function bindPatientManagementModal() {
  document.querySelectorAll('[data-action="close-patient-management-modal"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target !== element && element.classList.contains('modal-backdrop')) return;
      state.editingPatientId = '';
      renderContent();
    });
  });

  document.querySelector('#patientEditForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#patientEditMessage');
    if (message) message.textContent = '';
    try {
      await api(`/api/candidates/${encodeURIComponent(form.dataset.patientId)}`, {
        method: 'PATCH',
        body: {
          fullName: data.get('fullName'),
          employeeId: data.get('employeeId'),
          nationalId: data.get('nationalId'),
          dateOfBirth: data.get('dateOfBirth'),
          email: data.get('email'),
          contactNumber: data.get('contactNumber'),
          address: data.get('address'),
          emergencyContactName: data.get('emergencyContactName'),
          emergencyContactNumber: data.get('emergencyContactNumber'),
          primaryPhysician: data.get('primaryPhysician'),
          position: data.get('position')
        }
      });
      state.editingPatientId = '';
      state.patientManagementLoaded = false;
      await loadPatientManagementData(false);
      renderContent();
    } catch (err) {
      if (message) message.textContent = err.message;
    }
  });
}

function renderSetup() {
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Create medical office user</h2>
            <div class="muted">Set up a doctor or support clinician for a medical facility.</div>
          </div>
        </div>
        <div class="panel-body">
          <form id="doctorSetupForm" class="form-stack">
            <div class="grid-3">
              ${field('email', 'Email', 'email', true)}
              ${field('displayName', 'Name', 'text', true)}
              ${field('password', 'Temporary password', 'password', true)}
              <div class="field">
                <label for="setupOfficeUserType">Office user type</label>
                <select id="setupOfficeUserType" name="officeUserType">
                  <option value="doctor">Doctor</option>
                  <option value="clinician">Clinician / support</option>
                </select>
              </div>
              ${field('facilityName', 'Medical facility')}
              ${field('facilityAddress', 'Facility address')}
              ${field('registrationNumber', 'Registration number')}
              ${field('defaultMedicalFee', 'Doctor rate', 'number')}
            </div>
            <button class="primary-btn" type="submit">Create office user</button>
          </form>
          <div id="doctorSetupMessage" class="notice is-quiet setup-message" role="status"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Create reviewer profile</h2>
            <div class="muted">Set up National Commercial Bank team members who can review submitted medical forms.</div>
          </div>
        </div>
        <div class="panel-body">
          <form id="reviewerSetupForm" class="compact-form">
            ${field('email', 'Reviewer email', 'email', true)}
            ${field('displayName', 'Reviewer name', 'text', true)}
            ${field('password', 'Temporary password', 'password', true)}
            <button class="primary-btn" type="submit">Create reviewer</button>
          </form>
          <div id="reviewerSetupMessage" class="notice is-quiet setup-message" role="status"></div>
          <div class="user-table setup-list" id="reviewerTable">${renderReviewerRows()}</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Create patient profile</h2>
            <div class="muted">Create the patient master record. Medical cases are created separately.</div>
          </div>
        </div>
        <div class="panel-body">
          <form id="candidateSetupForm" class="form-stack">
            <div class="grid-3">
              ${field('fullName', 'Full name', 'text', true)}
              ${field('employeeId', 'Employee/applicant ID')}
              ${field('nationalId', 'National ID/TRN')}
              ${field('dateOfBirth', 'Date of birth', 'date', true)}
              ${field('email', 'Email', 'email')}
              ${field('contactNumber', 'Contact number')}
              ${field('position', 'Position applied for', 'text', true)}
            </div>
            <button class="primary-btn" type="submit">Create patient profile</button>
          </form>
          <div id="candidateSetupMessage" class="notice is-quiet setup-message" role="status"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Monthly doctor tracking</h2>
            <div class="muted">Medical cases assigned to each doctor by month, with submitted forms shown beside them.</div>
          </div>
          <button class="secondary-btn" data-action="refresh-setup">Refresh</button>
        </div>
        <div class="panel-body">
          <div class="tracking-table" id="trackingTable">${renderTrackingRows()}</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Patient profiles</h2>
        </div>
        <div class="panel-body">
          <div class="user-table" id="candidateTable">${renderCandidateRows()}</div>
        </div>
      </section>
    </div>
  `;
}

function bindSetup() {
  loadSetupData();

  document.querySelector('#notificationSettingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#notificationSettingsMessage');
    message.textContent = '';
    try {
      const response = await api('/api/notification-settings', {
        method: 'PUT',
        body: {
          notificationEmail: data.get('notificationEmail'),
          doctorNotificationEmail: data.get('doctorNotificationEmail')
        }
      });
      state.settings = { ...state.settings, ...response.settings };
      message.textContent = 'Notification emails saved.';
    } catch (err) {
      message.textContent = err.message;
    }
  });

  document.querySelector('#doctorSetupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#doctorSetupMessage');
    message.textContent = '';
    try {
      await api('/api/setup/clinicians', {
        method: 'POST',
        body: {
          email: data.get('email'),
          displayName: data.get('displayName'),
          password: data.get('password'),
          medicalProfile: {
            officeUserType: data.get('officeUserType'),
            facilityName: data.get('facilityName'),
            facilityAddress: data.get('facilityAddress'),
            clinicianName: data.get('displayName'),
            registrationNumber: data.get('registrationNumber'),
            defaultMedicalFee: data.get('defaultMedicalFee')
          }
        }
      });
      form.reset();
      message.textContent = 'Doctor account created.';
      await loadSetupData();
    } catch (err) {
      message.textContent = err.message;
    }
  });

  document.querySelector('#reviewerSetupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#reviewerSetupMessage');
    message.textContent = '';
    try {
      await api('/api/setup/reviewers', {
        method: 'POST',
        body: {
          email: data.get('email'),
          displayName: data.get('displayName'),
          password: data.get('password')
        }
      });
      form.reset();
      message.textContent = 'Reviewer profile created.';
      await loadSetupData();
    } catch (err) {
      message.textContent = err.message;
    }
  });

  document.querySelector('#candidateSetupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector('#candidateSetupMessage');
    message.textContent = '';
    try {
      await api('/api/candidates', {
        method: 'POST',
        body: {
          fullName: data.get('fullName'),
          employeeId: data.get('employeeId'),
          nationalId: data.get('nationalId'),
          dateOfBirth: data.get('dateOfBirth'),
          email: data.get('email'),
          contactNumber: data.get('contactNumber'),
          position: data.get('position')
        }
      });
      form.reset();
      message.textContent = 'Patient profile created.';
      await loadSetupData();
    } catch (err) {
      message.textContent = err.message;
    }
  });

  document.querySelector('[data-action="refresh-setup"]')?.addEventListener('click', loadSetupData);
}

async function loadSetupData() {
  const [cliniciansResponse, reviewersResponse, candidatesResponse, reportResponse, notificationResponse] = await Promise.all([
    api('/api/setup/clinicians'),
    api('/api/setup/reviewers'),
    api('/api/candidates'),
    api('/api/reports/monthly-doctors'),
    api('/api/notification-settings')
  ]);
  state.clinicians = cliniciansResponse.clinicians || [];
  state.reviewers = reviewersResponse.reviewers || [];
  state.candidates = candidatesResponse.candidates || [];
  state.monthlyReport = reportResponse.report || [];
  state.settings = { ...state.settings, ...(notificationResponse.settings || {}) };

  const notificationForm = document.querySelector('#notificationSettingsForm');
  if (notificationForm) {
    notificationForm.elements.notificationEmail.value = state.settings.notificationEmail || '';
    notificationForm.elements.doctorNotificationEmail.value = state.settings.doctorNotificationEmail || '';
  }

  const trackingTable = document.querySelector('#trackingTable');
  if (trackingTable) trackingTable.innerHTML = renderTrackingRows();
  const candidateTable = document.querySelector('#candidateTable');
  if (candidateTable) {
    candidateTable.innerHTML = renderCandidateRows();
    bindCandidateRows();
  }
  const reviewerTable = document.querySelector('#reviewerTable');
  if (reviewerTable) reviewerTable.innerHTML = renderReviewerRows();
}

function renderCaseManagement() {
  const workspaceCase = state.selectedCaseWorkspaceId
    ? (state.cases || []).find((medicalCase) => medicalCase.id === state.selectedCaseWorkspaceId)
    : null;
  if (workspaceCase) return renderCaseWorkspace(workspaceCase);
  if (state.showNewCaseForm) return renderNewMedicalCasePage();

  const filtered = filteredCases();
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.casePage = Math.min(state.casePage, pageCount);
  const pageRows = filtered.slice((state.casePage - 1) * pageSize, state.casePage * pageSize);
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Medical cases</h2>
            <div class="muted">Showing ${pageRows.length} of ${filtered.length} matching cases.</div>
          </div>
          <div class="header-actions">
            <button class="secondary-btn compact-primary" data-action="refresh-cases" type="button">Refresh</button>
            <button class="primary-btn compact-primary" type="button" data-action="start-new-case">New medical</button>
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="field inline-filter">
            <label class="sr-only" for="caseSearch">Search cases</label>
            <input id="caseSearch" type="search" value="${escapeHtml(state.caseSearch)}" placeholder="Search patient, case ID, office, stage, billing">
          </div>
          <div id="caseMessage" class="notice is-quiet setup-message" role="status"></div>
          <div class="user-table case-management-table" id="caseTable">${renderCaseRows(pageRows)}</div>
          <div class="pagination-bar">
            <button class="secondary-btn" type="button" data-action="case-prev-page" ${state.casePage <= 1 ? 'disabled' : ''}>Previous</button>
            <span>Page ${state.casePage} of ${pageCount}</span>
            <button class="secondary-btn" type="button" data-action="case-next-page" ${state.casePage >= pageCount ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function bindCaseManagement() {
  loadCaseManagementData();
  if (state.showNewCaseForm) applyFormTemplate(document.querySelector('#caseForm'), 'hr');
  document.querySelector('#caseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const doctor = state.clinicians.find((item) => item.id === data.get('assignedClinicianId'));
    const message = document.querySelector('#caseMessage');
    message.textContent = '';
    try {
      await api('/api/cases', {
        method: 'POST',
        body: {
          patientId: data.get('patientId'),
          route: data.get('route'),
          assignedClinicianId: data.get('assignedClinicianId'),
          assignedClinicianName: doctor?.displayName || '',
          customFields: collectCustomFields(form)
        }
      });
      form.reset();
      state.prefillPatientId = '';
      state.showNewCaseForm = false;
      state.caseOfficeSearch = '';
      state.selectedCaseOfficeId = '';
      message.textContent = 'Medical case created.';
      await loadCaseManagementData();
      renderContent();
    } catch (err) {
      message.textContent = err.message;
    }
  });
  document.querySelector('[data-action="refresh-cases"]')?.addEventListener('click', loadCaseManagementData);
  document.querySelector('[data-action="start-new-case"]')?.addEventListener('click', () => {
    state.showNewCaseForm = true;
    state.selectedCaseWorkspaceId = '';
    state.caseWorkspaceSubmission = null;
    state.caseWorkspaceSubmissionId = '';
    state.casePatientSearch = '';
    state.casePatientPage = 1;
    state.caseOfficeSearch = '';
    state.selectedCaseOfficeId = '';
    renderContent();
  });
  document.querySelector('[data-action="back-to-cases"]')?.addEventListener('click', () => {
    state.showNewCaseForm = false;
    state.selectedCaseWorkspaceId = '';
    state.caseWorkspaceSubmission = null;
    state.caseWorkspaceSubmissionId = '';
    state.prefillPatientId = '';
    state.caseOfficeSearch = '';
    state.selectedCaseOfficeId = '';
    renderContent();
  });
  const searchCasePatients = debounce(async (query) => {
    const response = await api(`/api/candidates?limit=100&q=${encodeURIComponent(query)}`);
    state.candidates = response.candidates || [];
    state.casePatientPage = 1;
    renderContent();
  }, 250);
  document.querySelector('#casePatientSearch')?.addEventListener('input', (event) => {
    state.casePatientSearch = event.currentTarget.value;
    state.casePatientPage = 1;
    searchCasePatients(state.casePatientSearch);
  });
  document.querySelector('[data-action="case-patient-prev-page"]')?.addEventListener('click', () => {
    state.casePatientPage = Math.max(1, state.casePatientPage - 1);
    renderContent();
  });
  document.querySelector('[data-action="case-patient-next-page"]')?.addEventListener('click', () => {
    state.casePatientPage += 1;
    renderContent();
  });
  const searchCases = debounce(async (query) => {
    const response = await api(`/api/cases?limit=100&q=${encodeURIComponent(query)}`);
    state.cases = response.cases || [];
    const rows = filteredCases().slice(0, 10);
    const table = document.querySelector('#caseTable');
    if (table) table.innerHTML = renderCaseRows(rows);
    bindCaseRows();
  }, 250);
  document.querySelector('#caseSearch')?.addEventListener('input', (event) => {
    state.caseSearch = event.currentTarget.value;
    state.casePage = 1;
    searchCases(state.caseSearch);
  });
  document.querySelector('[data-action="case-prev-page"]')?.addEventListener('click', () => {
    state.casePage = Math.max(1, state.casePage - 1);
    renderContent();
  });
  document.querySelector('[data-action="case-next-page"]')?.addEventListener('click', () => {
    state.casePage += 1;
    renderContent();
  });
  document.querySelector('#caseWorkspaceForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const doctor = state.clinicians.find((item) => item.id === data.get('assignedClinicianId'));
    await api(`/api/cases/${encodeURIComponent(form.dataset.caseId)}`, {
      method: 'PATCH',
      body: {
        status: data.get('status'),
        assignedClinicianId: data.get('assignedClinicianId'),
        assignedClinicianName: doctor?.displayName || '',
        paymentStatus: data.get('paymentStatus'),
        payableAmount: data.get('payableAmount')
      }
    });
    await loadCaseManagementData();
    renderContent();
  });
  const caseWorkspaceTabs = document.querySelector('#caseWorkspaceTabs');
  if (caseWorkspaceTabs) bindTabs(caseWorkspaceTabs);
  document.querySelector('#caseOfficeSearch')?.addEventListener('input', (event) => {
    state.caseOfficeSearch = event.currentTarget.value;
    const table = document.querySelector('#caseOfficeTable');
    if (table) table.innerHTML = renderCaseOfficeRows(filteredCaseOffices());
    bindCaseOfficeRows();
  });
  bindCasePatientRows();
  bindCaseOfficeRows();
}

async function loadCaseManagementData() {
  const [patientsResponse, cliniciansResponse, casesResponse, officeResponse] = await Promise.all([
    api('/api/candidates?limit=250'),
    api('/api/setup/clinicians?limit=250'),
    api('/api/cases?limit=250'),
    api('/api/medical-offices?limit=250').catch(() => ({ offices: [] }))
  ]);
  state.candidates = patientsResponse.candidates || [];
  state.clinicians = cliniciansResponse.clinicians || [];
  state.cases = casesResponse.cases || [];
  state.medicalOffices = officeResponse.offices || [];

  const patientSelect = document.querySelector('#casePatientId');
  if (patientSelect) {
    patientSelect.innerHTML = '<option value="">Select patient</option>' + state.candidates
      .map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)} - ${escapeHtml(patient.employeeId || patient.email || 'No identifier')}</option>`)
      .join('');
    if (state.prefillPatientId) patientSelect.value = state.prefillPatientId;
  }
  const doctorSelect = document.querySelector('#caseDoctorId');
  if (doctorSelect) {
    doctorSelect.innerHTML = '<option value="">Patient will choose / unassigned</option>' + state.clinicians
      .filter(isDoctorOfficeUser)
      .map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.displayName)} - ${escapeHtml(doctor.email)}</option>`)
      .join('');
  }
  const table = document.querySelector('#caseTable');
  if (table) {
    table.innerHTML = renderCaseRows(filteredCases().slice((state.casePage - 1) * 10, state.casePage * 10));
    bindCaseRows();
  }
}

function filteredCases() {
  const query = state.caseSearch.trim().toLowerCase();
  return (state.cases || []).filter((medicalCase) => !query || [
    medicalCase.patientName,
    medicalCase.employeeId,
    medicalCase.position,
    medicalCase.assignedClinicianName,
    caseStatusLabels[medicalCase.status],
    caseStageLabel(medicalCase),
    paymentStatusLabel(doctorPaymentStatus(medicalCase)),
    medicalCase.id
  ].join(' ').toLowerCase().includes(query));
}

function filteredCasePatients() {
  const query = state.casePatientSearch.trim().toLowerCase();
  return (state.candidates || []).filter((patient) => !query || [
    patient.fullName,
    patient.email,
    patient.employeeId,
    patient.nationalId,
    patient.contactNumber,
    patient.position
  ].join(' ').toLowerCase().includes(query));
}

function pagedCasePatients() {
  const pageSize = 10;
  const patients = filteredCasePatients();
  const pageCount = Math.max(1, Math.ceil(patients.length / pageSize));
  state.casePatientPage = Math.min(state.casePatientPage, pageCount);
  return {
    rows: patients.slice((state.casePatientPage - 1) * pageSize, state.casePatientPage * pageSize),
    total: patients.length,
    pageCount
  };
}

function filteredCaseOffices() {
  const query = state.caseOfficeSearch.trim().toLowerCase();
  return (state.medicalOffices || []).filter((office) => office.active !== false).filter((office) => !query || [
    office.name,
    office.address,
    office.phone,
    office.email
  ].join(' ').toLowerCase().includes(query));
}

function renderNewMedicalCasePage() {
  const pagedPatients = pagedCasePatients();
  const selectedPatient = state.prefillPatientId
    ? state.candidates.find((patient) => patient.id === state.prefillPatientId)
    : null;
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <button class="text-btn patient-back-btn" type="button" data-action="back-to-cases">Back to medical cases</button>
            <h2>New medical</h2>
            <div class="muted">${selectedPatient ? `Selected patient: ${escapeHtml(selectedPatient.fullName)}` : 'Search and select a patient to start a medical.'}</div>
          </div>
        </div>
        <div class="panel-body form-stack">
          ${selectedPatient ? renderNewCaseForm(selectedPatient) : `
            <div class="field inline-filter">
              <label class="sr-only" for="casePatientSearch">Search patients</label>
              <input id="casePatientSearch" type="search" value="${escapeHtml(state.casePatientSearch)}" placeholder="Search patient, email, applicant ID, TRN, phone">
            </div>
            <div class="user-table case-patient-table" id="casePatientTable">${renderCasePatientRows(pagedPatients.rows)}</div>
            <div class="pagination-bar">
              <button class="secondary-btn" type="button" data-action="case-patient-prev-page" ${state.casePatientPage <= 1 ? 'disabled' : ''}>Previous</button>
              <span>Page ${state.casePatientPage} of ${pagedPatients.pageCount}</span>
              <button class="secondary-btn" type="button" data-action="case-patient-next-page" ${state.casePatientPage >= pagedPatients.pageCount ? 'disabled' : ''}>Next</button>
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function renderCasePatientRows(patients) {
  if (!patients.length) return '<div class="empty">No patients found.</div>';
  return `
    <div class="user-row user-row-head case-patient-row">
      <strong>Patient</strong>
      <strong>Medicals</strong>
      <strong>Latest stage</strong>
      <strong>Billing</strong>
      <strong>Action</strong>
    </div>
    ${patients.map((patient) => {
      const cases = patientMedicalCases(patient);
      const latestCase = cases[0];
      return `
        <div class="user-row case-patient-row">
          <div>
            <strong>${escapeHtml(patient.fullName)}</strong>
            ${cases.length ? `<button class="text-btn inline-mini-action" type="button" data-filter-cases-by-patient="${escapeHtml(patient.fullName)}">view medicals</button>` : ''}
            <div class="muted">${escapeHtml([patient.employeeId, patient.email || 'No email'].filter(Boolean).join(' | '))}</div>
          </div>
          <span>${cases.length}</span>
          <span>${latestCase ? escapeHtml(caseStageLabel(latestCase)) : 'No medicals'}</span>
          <span>${latestCase ? escapeHtml(paymentStatusLabel(doctorPaymentStatus(latestCase))) : 'Not applicable'}</span>
          <div class="table-actions">
            <button class="text-btn" type="button" data-select-case-patient="${escapeHtml(patient.id)}">Select</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function renderNewCaseForm(patient) {
  const nameParts = splitName(patient.fullName);
  const selectedOffice = state.selectedCaseOfficeId
    ? state.medicalOffices.find((office) => office.id === state.selectedCaseOfficeId)
    : null;
  const selectedOfficeClinicians = selectedOffice ? officeClinicians(selectedOffice) : [];
  const selectedOfficeDoctors = selectedOffice ? officeDoctors(selectedOffice) : [];
  const assignedDoctor = selectedOfficeDoctors[0] || null;
  const selectedOfficeFee = selectedOffice?.defaultMedicalFee ? formatCurrency(selectedOffice.defaultMedicalFee) : 'No office fee set';
  const assignedDoctorFee = assignedDoctor?.medicalProfile?.defaultMedicalFee ? formatCurrency(assignedDoctor.medicalProfile.defaultMedicalFee) : 'No doctor rate set';
  const offices = filteredCaseOffices().slice(0, 10);
  return `
    <form id="caseForm" class="form-stack case-create-card">
      <div class="section-heading-row">
        <h3>Create medical for ${escapeHtml(patient.fullName)}</h3>
        <span>${escapeHtml(patient.employeeId || patient.email || patient.id)}</span>
      </div>
      <div class="patient-summary-grid">
        ${summaryTile('First name', nameParts.firstName || 'Not recorded')}
        ${summaryTile('Last name', nameParts.lastName || 'Not recorded')}
        ${summaryTile('Applicant ID', patient.employeeId || 'Not recorded')}
        ${summaryTile('TRN / national ID', patient.nationalId || 'Not recorded')}
        ${summaryTile('Date of birth', patient.dateOfBirth || 'Not recorded')}
        ${summaryTile('Phone', patient.contactNumber || 'Not recorded')}
        ${summaryTile('Position', patient.position || 'Not recorded')}
        ${summaryTile('Email', patient.email || 'Not recorded')}
        ${summaryTile('Address', patient.address || 'Not recorded')}
        ${summaryTile('Primary physician', patient.primaryPhysician || 'Not recorded')}
      </div>
      <input type="hidden" name="patientId" value="${escapeHtml(patient.id)}">
      <input type="hidden" name="assignedClinicianId" value="${escapeHtml(assignedDoctor?.id || '')}">
      <div class="grid-3">
        <div class="field">
          <label for="caseRoute">Routing</label>
          <select id="caseRoute" name="route" required>
            <option value="patient">Send to patient first</option>
            <option value="doctor">Send directly to doctor office</option>
          </select>
        </div>
      </div>
      <section class="office-assignment-panel">
        <div class="section-heading-row">
          <h3>Medical office</h3>
          <span>${selectedOffice ? `${selectedOfficeDoctors.length} doctors, ${selectedOfficeClinicians.length - selectedOfficeDoctors.length} support` : 'Optional'}</span>
        </div>
        <div class="field inline-filter">
          <label class="sr-only" for="caseOfficeSearch">Search medical offices</label>
          <input id="caseOfficeSearch" type="search" value="${escapeHtml(state.caseOfficeSearch)}" placeholder="Search medical office by name, address, phone, email">
        </div>
        <div class="user-table office-case-table" id="caseOfficeTable">${renderCaseOfficeRows(offices)}</div>
        ${selectedOffice ? `
          <div class="notice is-quiet">
            Selected: ${escapeHtml(selectedOffice.name)}. ${escapeHtml(selectedOffice.address || 'No address recorded')}. ${assignedDoctor ? `Responsible doctor: ${escapeHtml(assignedDoctor.displayName)}.` : 'No doctor is assigned to this office yet.'} Office fee: ${escapeHtml(selectedOfficeFee)}. Doctor rate: ${escapeHtml(assignedDoctorFee)}.
          </div>
        ` : ''}
      </section>
      ${renderCustomFields('hr')}
      <div id="caseMessage" class="notice is-quiet setup-message" role="status"></div>
      <button class="primary-btn compact-primary" type="submit">Create medical case</button>
    </form>
  `;
}

function renderCaseOfficeRows(offices) {
  if (!offices.length) return '<div class="empty">No medical offices found.</div>';
  return `
    <div class="user-row user-row-head medical-office-row">
      <strong>Medical office</strong>
      <strong>Doctors</strong>
      <strong>Action</strong>
    </div>
    ${offices.map((office) => `
      <div class="user-row medical-office-row ${office.id === state.selectedCaseOfficeId ? 'is-selected-row' : ''}">
        <div>
          <strong>${escapeHtml(office.name)}</strong>
          <div class="muted">${escapeHtml([office.address, office.phone, office.email, office.defaultMedicalFee ? `Fee ${formatCurrency(office.defaultMedicalFee)}` : 'No fee set'].filter(Boolean).join(' | ') || 'No contact details recorded')}</div>
        </div>
        <span>${officeClinicians(office).length}</span>
        <div class="table-actions">
          <button class="text-btn" type="button" data-select-case-office="${escapeHtml(office.id)}">${office.id === state.selectedCaseOfficeId ? 'Selected' : 'Select'}</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderCaseRows(rows = state.cases) {
  if (!rows.length) return '<div class="empty">No medical cases found.</div>';
  return `
    <div class="user-row user-row-head case-management-row">
      <strong>Patient</strong>
      <strong>Stage</strong>
      <strong>Billing</strong>
      <strong>Status</strong>
      <strong>Action</strong>
    </div>
    ${rows.map((medicalCase) => `
      <div class="user-row case-management-row" data-case-id="${escapeHtml(medicalCase.id)}">
        <div>
          <strong>${escapeHtml(medicalCase.patientName)}</strong>
          <div class="muted">${escapeHtml(medicalCase.id)} | ${escapeHtml(medicalCase.employeeId || 'No applicant ID')} | ${escapeHtml(medicalCase.assignedClinicianName || 'Unassigned')}</div>
        </div>
        <span>${escapeHtml(caseStageLabel(medicalCase))}</span>
        <span>${escapeHtml(paymentStatusLabel(doctorPaymentStatus(medicalCase)))}</span>
        <span>${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status || 'Not recorded')}</span>
        <div class="candidate-actions">
          <button class="text-btn" type="button" data-open-case-workspace="${escapeHtml(medicalCase.id)}">Open</button>
        </div>
      </div>
    `).join('')}
  `;
}

function bindCaseRows() {
  document.querySelectorAll('[data-open-case-workspace]').forEach((button) => {
    button.addEventListener('click', () => {
      openCaseWorkspace(button.dataset.openCaseWorkspace);
    });
  });
}

async function openCaseWorkspace(caseId) {
  state.selectedCaseWorkspaceId = caseId;
  state.caseWorkspaceSubmission = null;
  state.caseWorkspaceSubmissionId = '';
  state.showNewCaseForm = false;
  try {
    const response = await api(`/api/cases/${encodeURIComponent(caseId)}`);
    if (response.case) {
      state.cases = [
        ...(state.cases || []).filter((item) => item.id !== caseId),
        response.case
      ];
    }
  } catch {}
  renderContent();

  const medicalCase = (state.cases || []).find((item) => item.id === caseId);
  if (!medicalCase?.submissionId) return;
  try {
    const response = await api(`/api/submissions/${encodeURIComponent(medicalCase.submissionId)}`);
    state.caseWorkspaceSubmission = response.submission || null;
    state.caseWorkspaceSubmissionId = medicalCase.submissionId;
    if (state.selectedCaseWorkspaceId === caseId) renderContent();
  } catch {
    state.caseWorkspaceSubmission = null;
    state.caseWorkspaceSubmissionId = medicalCase.submissionId;
  }
}

function bindCasePatientRows() {
  document.querySelectorAll('[data-select-case-patient]').forEach((button) => {
    button.addEventListener('click', () => {
      state.prefillPatientId = button.dataset.selectCasePatient;
      state.caseOfficeSearch = '';
      state.selectedCaseOfficeId = '';
      renderContent();
    });
  });
  document.querySelectorAll('[data-filter-cases-by-patient]').forEach((button) => {
    button.addEventListener('click', () => {
      state.caseSearch = button.dataset.filterCasesByPatient;
      state.showNewCaseForm = false;
      state.prefillPatientId = '';
      state.selectedCaseWorkspaceId = '';
      state.casePage = 1;
      renderContent();
    });
  });
  document.querySelectorAll('[data-open-case-workspace]').forEach((button) => {
    button.addEventListener('click', () => {
      openCaseWorkspace(button.dataset.openCaseWorkspace);
    });
  });
}

function bindCaseOfficeRows() {
  document.querySelectorAll('[data-select-case-office]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCaseOfficeId = button.dataset.selectCaseOffice;
      renderContent();
    });
  });
}

function renderCaseWorkspace(medicalCase) {
  const patientData = medicalCase.patientCaseData || {};
  const submission = state.caseWorkspaceSubmissionId === medicalCase.submissionId ? state.caseWorkspaceSubmission : null;
  return `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header patient-detail-header case-workspace-header">
          <div>
            <button class="text-btn patient-back-btn" type="button" data-action="back-to-cases">Back to medical cases</button>
            <h2>${escapeHtml(medicalCase.patientName || 'Medical case')}</h2>
            <div class="muted">${escapeHtml(medicalCase.id)} | ${escapeHtml(caseStageLabel(medicalCase))}</div>
          </div>
          <div class="header-actions">
            ${medicalCase.submissionId ? `<a class="secondary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/print" target="_blank" rel="noopener">Export full medical PDF</a>` : '<button class="secondary-btn compact-primary" type="button" disabled>PDF unavailable</button>'}
          </div>
        </div>
        <div class="panel-body form-stack">
          <div class="case-workspace-strip">
            ${caseWorkspacePill('Status', caseStatusLabels[medicalCase.status] || medicalCase.status || 'Not recorded')}
            ${caseWorkspacePill('Stage', caseStageLabel(medicalCase))}
            ${caseWorkspacePill('Billing', `${paymentStatusLabel(doctorPaymentStatus(medicalCase))}${medicalCase.payableAmount ? ` · ${formatCurrency(medicalCase.payableAmount)}` : ''}`)}
            ${caseWorkspacePill('Office', medicalCase.assignedClinicianName || 'Unassigned')}
          </div>

          <div id="caseWorkspaceTabs" class="case-workspace-tabs">
            <div class="tab-list case-tab-list" role="tablist" aria-label="Medical case details">
              ${['Overview', 'Patient form', 'Doctor assessment', 'Billing & status', 'Documents'].map((label, index) => `
                <button class="tab-button ${index === 0 ? 'is-active' : ''}" type="button" data-tab="${index}">${escapeHtml(label)}</button>
              `).join('')}
            </div>
            <section class="tab-panel is-active" data-tab-panel="0">
              ${recordSection('Case', [
                ['Case ID', medicalCase.id],
                ['Created', formatDateTime(medicalCase.createdAt)],
                ['Updated', formatDateTime(medicalCase.updatedAt)],
                ['Route', medicalCase.route],
                ['Assigned', formatDateTime(medicalCase.assignedAt)]
              ])}
              ${renderCustomFieldRecordSection('HR case fields', 'hr', medicalCase.customFields)}
              ${recordSection('Patient profile', patientProfileRows(medicalCase))}
            </section>
            <section class="tab-panel" data-tab-panel="1">
              ${recordSection('Personal and consent', patientPersonalRows(patientData, medicalCase))}
              ${renderCustomFieldRecordSection('Patient additional fields', 'patient', patientData.customFields)}
              ${renderPatientFamilyHistory(patientData)}
              ${renderPatientMedicalHistory(patientData, medicalCase)}
            </section>
            <section class="tab-panel" data-tab-panel="2">
              ${submission ? renderSubmissionAssessment(submission) : '<div class="empty">The doctor assessment has not been finally submitted yet.</div>'}
              ${!submission && medicalCase.doctorDraft ? renderDoctorDraftSnapshot(medicalCase.doctorDraft) : ''}
              ${renderCustomFieldRecordSection('Doctor additional fields', 'doctor', submission?.customFields || medicalCase.doctorDraft?.customFields)}
              ${recordSection('Case doctor activity', doctorAssessmentSummaryRows(medicalCase))}
            </section>
            <section class="tab-panel" data-tab-panel="3">
              <form id="caseWorkspaceForm" class="case-workspace-form form-stack" data-case-id="${escapeHtml(medicalCase.id)}">
                <div class="grid-4">
                  <div class="field">
                    <label for="workspaceStatus">Status</label>
                    <select id="workspaceStatus" name="status">
                      ${Object.entries(caseStatusLabels).map(([status, label]) => `<option value="${escapeHtml(status)}" ${medicalCase.status === status ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label for="workspaceDoctor">Responsible doctor</label>
                    <select id="workspaceDoctor" name="assignedClinicianId">
                      <option value="">Unassigned</option>
                      ${state.clinicians.filter(isDoctorOfficeUser).map((doctor) => `<option value="${escapeHtml(doctor.id)}" ${medicalCase.assignedClinicianId === doctor.id ? 'selected' : ''}>${escapeHtml(doctor.displayName)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label for="workspacePayment">Billing status</label>
                    <select id="workspacePayment" name="paymentStatus">
                      ${['unpaid', 'paid', 'not_payable'].map((status) => `<option value="${status}" ${doctorPaymentStatus(medicalCase) === status ? 'selected' : ''}>${escapeHtml(paymentStatusLabel(status))}</option>`).join('')}
                    </select>
                  </div>
                  ${field('payableAmount', 'Payable amount', 'number', false, medicalCase.payableAmount || '')}
                </div>
                <button class="primary-btn compact-primary" type="submit">Save case</button>
              </form>
            </section>
            <section class="tab-panel" data-tab-panel="4">
              ${renderCaseDocuments(medicalCase, submission)}
            </section>
          </div>
        </div>
      </section>
    </div>
  `;
}

function caseWorkspacePill(label, value) {
  return `
    <div class="case-workspace-pill">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Not recorded')}</strong>
    </div>
  `;
}

function renderCustomFieldRecordSection(title, surface, values = {}) {
  const rows = customFieldRows(surface, values);
  return rows.length ? recordSection(title, rows) : '';
}

function customFieldRows(surface, values = {}) {
  const fields = currentFormTemplate().fields
    .filter((field) => field.surface === surface && !field.builtIn && field.type !== 'information');
  return fields.map((field) => [
    field.label || field.name || field.id,
    formatCustomFieldValue(values?.[field.id], field)
  ]).filter(([, value]) => value !== '');
}

function formatCustomFieldValue(value, field) {
  if (field?.type === 'checkbox') return value === true || value === 'on' ? 'Yes' : 'No';
  return value === undefined || value === null ? '' : String(value);
}

function patientProfileRows(medicalCase) {
  return [
    ['Name', medicalCase.patientName],
    ['Email', medicalCase.patientEmail],
    ['Applicant ID', medicalCase.employeeId],
    ['TRN / national ID', medicalCase.patientNationalId],
    ['Date of birth', medicalCase.patientDateOfBirth],
    ['Contact', medicalCase.patientContactNumber],
    ['Position', medicalCase.position]
  ];
}

function patientPersonalRows(patientData, medicalCase) {
  const personal = patientData.personalInfo || {};
  const consent = patientData.consent || {};
  return [
    ['First name', personal.firstName || splitName(medicalCase.patientName).firstName],
    ['Middle initial', personal.middleInitial],
    ['Last name', personal.lastName || splitName(medicalCase.patientName).lastName],
    ['Sex', personal.sex],
    ['Marital status', personal.maritalStatus],
    ['Address', [personal.addressLine1, personal.addressLine2, personal.cityTown, personal.parish, personal.country].filter(Boolean).join(', ')],
    ['Home phone', personal.homePhone],
    ['Mobile phone', personal.mobilePhone || medicalCase.patientContactNumber],
    ['Work phone', personal.workPhone],
    ['Primary doctor', personal.primaryPhysician],
    ['Primary doctor address', personal.primaryPhysicianAddress],
    ['Primary doctor phone', personal.primaryPhysicianPhone],
    ['Emergency contact', [personal.emergencyContactName, personal.emergencyContactNumber].filter(Boolean).join(' | ')],
    ['Consent accepted', consent.accepted ? 'Yes' : 'No'],
    ['Consent signed by', consent.signedBy],
    ['Consent signed', formatDateTime(consent.signedAt)]
  ];
}

function renderPatientFamilyHistory(patientData) {
  const family = patientData.familyHistory || {};
  return `
    <div class="case-tab-section">
      <h3>Family history</h3>
      ${readonlyTable(['Relative', 'Age', 'State of health or cause of death', 'Age at death'], (family.relatives || []).map((row) => [
        row.relationship,
        row.age,
        row.stateOfHealth,
        row.ageAtDeath
      ]))}
      <h3>Family illnesses or disorders</h3>
      ${readonlyTable(['Illness or disorder', 'Answer', 'Who'], (family.disorders || []).map((row) => [
        row.name,
        patientAnswerLabel(row.answer),
        row.who
      ]))}
      ${readonlyNotes('Family history notes', family.notes)}
    </div>
  `;
}

function renderPatientMedicalHistory(patientData, medicalCase) {
  const history = patientData.medicalHistory || {};
  const consent = patientData.consent || {};
  return `
    <div class="case-tab-section">
      <h3>Diseases or disorders</h3>
      ${readonlyTable(['Disease or disorder', 'Answer', 'Year'], (history.diseases || []).map((row) => [
        row.name,
        patientAnswerLabel(row.answer),
        row.year
      ]))}
      <h3>Additional medical questions</h3>
      ${readonlyTable(['Question', 'Answer', 'Details'], (history.questions || []).map((row) => [
        medicalQuestionLabel(row.key),
        row.type === 'text' || row.type === 'textarea' ? 'Response' : patientAnswerLabel(row.answer),
        patientQuestionDetails(row)
      ]))}
      ${readonlyNotes('Medication information', medicalCase.medicationInformation)}
      ${readonlyNotes('Additional notes', history.notes)}
      ${consent.signatureDataUrl ? `<div class="case-signature-card"><strong>Patient signature</strong><img src="${escapeHtml(consent.signatureDataUrl)}" alt="Patient signature"></div>` : ''}
    </div>
  `;
}

function renderSubmissionAssessment(submission) {
  return `
    ${recordSection('Assessment facility', [
      ['Medical facility', submission.assessment?.facilityName],
      ['Facility address', submission.assessment?.facilityAddress],
      ['Assessment date', submission.assessment?.assessmentDate],
      ['Clinician', submission.assessment?.clinicianName],
      ['Registration number', submission.assessment?.clinicianRegistrationNumber],
      ['Telephone', submission.assessment?.telephoneNumber],
      ['Email', submission.assessment?.emailAddress]
    ])}
    <div class="case-tab-section">
      <h3>Physician examination</h3>
      ${readonlyTable(['Section', 'Finding', 'Value'], physicianExamSections.flatMap((section) => section.fields.map(([key, label]) => [
        section.title,
        label,
        submission.physicalExam?.[key]
      ])))}
    </div>
    ${recordSection('Laboratory and conclusion', [
      ['Laboratory', submission.labResults?.additionalTests || submission.labResults?.otherTests],
      ['Determination', labelStatus(submission.determination?.status)],
      ['Conclusions', submission.determination?.conclusions],
      ['Restrictions', submission.determination?.restrictions],
      ['Recommendation', submission.determination?.recommendation],
      ['Follow-up date', submission.determination?.followUpDate],
      ['Signed by', submission.attestation?.signedBy],
      ['Signature date', submission.attestation?.signatureDate]
    ])}
    ${submission.attestation?.signatureDataUrl ? `<div class="case-signature-card"><strong>Doctor signature</strong><img src="${escapeHtml(submission.attestation.signatureDataUrl)}" alt="Doctor signature"></div>` : ''}
  `;
}

function renderDoctorDraftSnapshot(draft = {}) {
  const examRows = physicianExamSections.flatMap((section) => section.fields.map(([key, label]) => [
    section.title,
    label,
    draft.physicalExam?.[key]
  ])).filter(([, , value]) => value);
  const labRows = [
    ['Additional tests', draft.labResults?.additionalTests],
    ['Blood test', draft.labResults?.bloodTest],
    ['Urine test', draft.labResults?.urineTest],
    ['Chest X-ray', draft.labResults?.chestXray],
    ['Drug screen', draft.labResults?.drugScreen],
    ['Other tests', draft.labResults?.otherTests]
  ].filter(([, value]) => value);
  return `
    <div class="case-tab-section">
      <h3>Saved doctor draft</h3>
      ${recordSection('Assessment draft', [
        ['Medical facility', draft.assessment?.facilityName],
        ['Assessment date', draft.assessment?.assessmentDate],
        ['Clinician', draft.assessment?.clinicianName],
        ['Registration number', draft.assessment?.clinicianRegistrationNumber],
        ['Signed by', draft.attestation?.signedBy],
        ['Signature date', draft.attestation?.signatureDate]
      ])}
      ${examRows.length ? readonlyTable(['Section', 'Finding', 'Draft value'], examRows) : ''}
      ${labRows.length ? readonlyTable(['Laboratory item', 'Draft value'], labRows) : ''}
      ${recordSection('Draft determination', [
        ['Determination', labelStatus(draft.determination?.status)],
        ['Conclusions', draft.determination?.conclusions],
        ['Restrictions', draft.determination?.restrictions],
        ['Recommendation', draft.determination?.recommendation],
        ['Follow-up date', draft.determination?.followUpDate]
      ])}
      ${draft.attestation?.signatureDataUrl ? `<div class="case-signature-card"><strong>Draft doctor signature</strong><img src="${escapeHtml(draft.attestation.signatureDataUrl)}" alt="Draft doctor signature"></div>` : ''}
    </div>
  `;
}

function renderCaseDocuments(medicalCase, submission) {
  return `
    <div class="case-documents-grid">
      <div class="case-document-card">
        <h3>Full medical export</h3>
        <p>Exports the completed medical in a browser print view so signatures render in the PDF output.</p>
        ${medicalCase.submissionId ? `<a class="primary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/print" target="_blank" rel="noopener">Export full medical PDF</a>` : '<button class="primary-btn compact-primary" type="button" disabled>Export unavailable</button>'}
      </div>
      <div class="case-document-card">
        <h3>System PDF</h3>
        <p>Downloads the server-generated medical record with patient and doctor signatures.</p>
        ${medicalCase.submissionId ? `<a class="secondary-btn compact-primary" href="/submissions/${encodeURIComponent(medicalCase.submissionId)}/download">Download system PDF</a>` : '<button class="secondary-btn compact-primary" type="button" disabled>PDF unavailable</button>'}
      </div>
    </div>
    ${readonlyTable(['Attachment', 'Type', 'Uploaded'], (medicalCase.attachments || []).map((item) => [
      item.fileName,
      item.contentType,
      formatDateTime(item.uploadedAt)
    ]))}
    ${submission ? recordSection('Submission', [
      ['Submission ID', submission.id],
      ['Submitted at', formatDateTime(submission.submittedAt)],
      ['Review status', labelStatus(submission.review?.status || 'pending')],
      ['Review notes', submission.review?.notes]
    ]) : ''}
  `;
}

function caseFormSummaryRows(patientData, medicalCase) {
  const personal = patientData.personalInfo || {};
  const consent = patientData.consent || {};
  return [
    ['Sex', personal.sex],
    ['Marital status', personal.maritalStatus],
    ['Address', [personal.addressLine1, personal.addressLine2, personal.cityTown, personal.parish, personal.country].filter(Boolean).join(', ')],
    ['Primary doctor', personal.primaryPhysician],
    ['Emergency contact', [personal.emergencyContactName, personal.emergencyContactPhone].filter(Boolean).join(' | ')],
    ['Consent signed by', consent.signedBy],
    ['Consent signed', formatDateTime(consent.signedAt)],
    ['Medication information', medicalCase.medicationInformation]
  ];
}

function doctorAssessmentSummaryRows(medicalCase) {
  const draft = medicalCase.doctorDraft || {};
  return [
    ['Draft saved', draft.updatedAt ? formatDateTime(draft.updatedAt) : 'Not recorded'],
    ['Doctor submitted', formatDateTime(medicalCase.submittedAt)],
    ['Submission ID', medicalCase.submissionId],
    ['Attachments', Array.isArray(medicalCase.attachments) ? String(medicalCase.attachments.length) : '0'],
    ['Cancellation reason', medicalCase.cancellationReason || medicalCase.withdrawalReason]
  ];
}

function renderMyMedicals() {
  if (!state.cases.length) {
    loadMyMedicalCases();
  }
  return `
    <div class="patient-hero">
      <div>
        <h2>My Medicals</h2>
      </div>
      <button class="secondary-btn" data-action="refresh-my-medicals">Refresh</button>
    </div>
    <div id="myMedicalTable">${renderMyMedicalRows()}</div>
  `;
}

function bindMyMedicals() {
  if (state.selectedCase) {
    bindPatientCaseForm();
    return;
  }
  loadMyMedicalCases();
  document.querySelector('[data-action="refresh-my-medicals"]')?.addEventListener('click', loadMyMedicalCases);
}

async function loadMyMedicalCases() {
  try {
    const [casesResponse, cliniciansResponse] = await Promise.all([
      api('/api/cases'),
      api('/api/setup/clinicians').catch(() => ({ clinicians: [] }))
    ]);
    state.cases = casesResponse.cases || [];
    state.clinicians = cliniciansResponse.clinicians || [];
    const table = document.querySelector('#myMedicalTable');
    if (table) {
      table.innerHTML = renderMyMedicalRows();
      bindPatientCaseRows();
    }
  } catch {}
}

function renderMyMedicalRows() {
  if (!state.cases.length) return '<div class="empty">No medical cases are linked to your profile yet.</div>';
  const sortedCases = [...state.cases].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  const actionCases = sortedCases.filter((medicalCase) => medicalCase.status === 'sent_to_patient');
  return `
    <div class="medical-dashboard">
      ${actionCases.length ? `
        <section class="medical-action-panel" aria-label="Medical cases requiring action">
          ${actionCases.map((medicalCase) => renderMedicalActionCase(medicalCase)).join('')}
        </section>
      ` : `
        <section class="medical-ready-panel">
          <div>
            <span class="eyebrow">Up to date</span>
            <h3>No open cases</h3>
          </div>
        </section>
      `}
      <section class="medical-history-panel">
        <div class="section-heading">
          <div>
            <h3>Medical case history</h3>
            <div class="muted">${sortedCases.length} ${sortedCases.length === 1 ? 'case' : 'cases'} linked to your profile</div>
          </div>
        </div>
        <div class="medical-history-list">
          <div class="medical-history-row medical-history-head-row">
            <strong>Case</strong>
            <strong>Status</strong>
            <strong>Medical office</strong>
            <strong>Created</strong>
            <strong>Action</strong>
          </div>
          ${sortedCases.map((medicalCase) => renderMedicalHistoryRow(medicalCase)).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderMedicalActionCase(medicalCase) {
  return `
    <article class="medical-action-card">
      <div class="medical-action-status">
        <span class="action-dot" aria-hidden="true"></span>
        <span>Action required</span>
      </div>
      <div class="medical-action-main">
        <h4>${escapeHtml(medicalCase.position || 'Pre-employment medical')}</h4>
        <div class="medical-action-meta">
          <span>${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</span>
          <span>${escapeHtml(formatDateTime(medicalCase.createdAt))}</span>
          <span>${escapeHtml(medicalCase.id)}</span>
        </div>
      </div>
      <button class="primary-btn" type="button" data-action="open-patient-case" data-case-id="${escapeHtml(medicalCase.id)}">Complete medical</button>
    </article>
  `;
}

function renderMedicalHistoryRow(medicalCase) {
  const canPatientEdit = medicalCase.status === 'sent_to_patient';
  return `
    <div class="medical-history-row ${canPatientEdit ? 'needs-action' : ''}">
      <div>
        <strong>${escapeHtml(medicalCase.position || 'Pre-employment medical')}</strong>
        <span>${escapeHtml(medicalCase.id)}</span>
      </div>
      <span class="status ${escapeHtml(medicalCase.status)}">${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</span>
      <span>${escapeHtml(medicalCase.assignedClinicianName || 'Not selected')}</span>
      <span>${escapeHtml(formatDateTime(medicalCase.createdAt))}</span>
      <button class="${canPatientEdit ? 'primary-btn' : 'secondary-btn'}" type="button" data-action="open-patient-case" data-case-id="${escapeHtml(medicalCase.id)}">
        ${canPatientEdit ? 'Complete' : 'View'}
      </button>
    </div>
  `;
}

function bindPatientCaseRows() {
  document.querySelectorAll('[data-action="open-patient-case"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCase = state.cases.find((item) => item.id === button.dataset.caseId) || null;
      renderShell();
    });
  });
  document.querySelectorAll('[data-patient-case-id]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const doctor = state.clinicians.find((item) => item.id === data.get('assignedClinicianId'));
      await api(`/api/cases/${encodeURIComponent(form.dataset.patientCaseId)}`, {
        method: 'PATCH',
        body: {
          assignedClinicianId: data.get('assignedClinicianId'),
          assignedClinicianName: doctor?.displayName || ''
        }
      });
      await loadMyMedicalCases();
    });
  });
}

function renderPatientMedicalCaseForm() {
  const medicalCase = state.selectedCase;
  const canPatientEdit = medicalCase.status === 'sent_to_patient';
  const data = medicalCase?.patientCaseData || {};
  const personal = data.personalInfo || {};
  const consentText = `DISCLOSURE AND CONSENT :

Disclosure Notice
The collection of the information on this form is authorized by the applicant for disclosure and will be used to determine the fitness-for-duty. This information may be disclosed to the employees within the Group Human Resources Division of the National Commercial Bank Jamaica Limited for reasons including but not limited to employees' compensation, retirement, and other benefit entitlements. We may also be required to seek assistance from an expert consultant or other personnel on the Bank's medical panel which may also lead to the sharing of your medical information. In the case of a dispute regarding discrimination or any other legal matter, your information may also be shared with legal officers of the court. It is also noted that the Bank reserves the right to allow auditors internally and externally to view and assess employees' information and files for auditing purposes. Completion of this form is voluntary. If this information is not completed, the examination may be considered incomplete and a withdrawal from the employment process. Knowingly providing false or incomplete answers may result in the rescission of a conditional job offer or dismissal if discovered at a later time.

Consent and Certification
I hereby authorize collection and use of the medical information obtained for the purposes stated in the above Disclosure Notice and agree to release to the attending Physician, NCB, their medical representative(s) and/or other associates from any and all liability and responsibility arising out of the release of such information.
I have read and understood the provisions of the Disclosure Notice included in this form. I certify that all the information given by me in connection with this examination will be correct and complete to the best of my knowledge and belief.
I also understand that if additional medical examinations or assessments are required, this consent will also be extended to those procedures and physicians.`;
  const nameParts = splitName(medicalCase.patientName);
  return `
    <form id="patientCaseForm" class="assessment-form">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>${escapeHtml(medicalCase.patientName || 'Medical case')}</h2>
            <div class="muted">${escapeHtml(caseStatusLabels[medicalCase.status] || medicalCase.status)}</div>
          </div>
          <button class="secondary-btn" type="button" data-action="back-my-medicals">Back</button>
        </div>
        <div class="panel-body form-stack">
          <div class="tab-list" role="tablist" aria-label="Patient medical form sections">
            ${['Personal & consent', 'Family history', 'Medical history'].map((label, index) => `
              <button class="tab-button ${index === 0 ? 'is-active' : ''}" type="button" data-tab="${index}">${escapeHtml(label)}</button>
            `).join('')}
          </div>
          <section class="tab-panel is-active" data-tab-panel="0">
            <h3>Personal information</h3>
            <div class="form-section section-personal">
              <h4>Name and demographics</h4>
              <div class="grid-3">
                ${field('personalInfo.firstName', 'First name', 'text', true, personal.firstName || nameParts.firstName)}
                ${field('personalInfo.middleInitial', 'Middle initial', 'text', false, personal.middleInitial || nameParts.middleInitial)}
                ${field('personalInfo.lastName', 'Last name', 'text', true, personal.lastName || nameParts.lastName)}
                ${readonlyField('Employee/applicant ID', medicalCase.employeeId)}
                ${selectField('personalInfo.sex', 'Sex', ['Male', 'Female'], personal.sex || '', true)}
                ${selectField('personalInfo.maritalStatus', 'Marital status', ['Single', 'Married', 'Divorced', 'Separated', 'Widowed'], personal.maritalStatus || '')}
                ${readonlyField('Email address', medicalCase.patientEmail)}
              </div>
            </div>
            <div class="form-section section-address">
              <h4>Address</h4>
              <div class="grid-2">
                ${field('personalInfo.addressLine1', 'Address line 1', 'text', true, personal.addressLine1 || personal.address || '')}
                ${field('personalInfo.addressLine2', 'Address line 2', 'text', false, personal.addressLine2 || '')}
                ${field('personalInfo.cityTown', 'City / town', 'text', false, personal.cityTown || '')}
                ${field('personalInfo.parish', 'Parish / state', 'text', false, personal.parish || '')}
                ${field('personalInfo.country', 'Country', 'text', false, personal.country || 'Jamaica')}
              </div>
            </div>
            <div class="form-section section-contact">
              <h4>Contact numbers</h4>
              <div class="grid-3">
                ${phoneField('personalInfo.homePhone', 'Home phone', personal.homePhone || personal.phoneNumber || '')}
                ${phoneField('personalInfo.mobilePhone', 'Mobile phone', personal.mobilePhone || medicalCase.patientContactNumber || '')}
                ${phoneField('personalInfo.workPhone', 'Work phone', personal.workPhone || '')}
              </div>
            </div>
            <div class="form-section section-doctor">
              <h4>Primary doctor</h4>
              <div class="grid-3">
                ${field('personalInfo.primaryPhysician', 'Primary doctor name', 'text', false, personal.primaryPhysician || '')}
                ${field('personalInfo.primaryPhysicianAddress', 'Primary doctor address', 'text', false, personal.primaryPhysicianAddress || '')}
                ${phoneField('personalInfo.primaryPhysicianPhone', 'Primary doctor phone', personal.primaryPhysicianPhone || '')}
              </div>
            </div>
            <div class="form-section section-emergency">
              <h4>Emergency contact</h4>
              <div class="grid-2">
                ${field('personalInfo.emergencyContactName', 'Emergency contact name', 'text', false, personal.emergencyContactName || '')}
                ${phoneField('personalInfo.emergencyContactNumber', 'Emergency contact number', personal.emergencyContactNumber || '')}
              </div>
            </div>
            <div class="section-divider"></div>
            <div class="form-section">
              <h3>Disclosure, consent, and certification</h3>
              <div class="notice is-quiet legal-copy">${escapeHtml(consentText)}</div>
              <label class="check"><input name="consent.accepted" type="checkbox" ${data.consent?.accepted ? 'checked' : ''} ${canPatientEdit ? '' : 'disabled'}> <span>I agree and consent to this medical assessment.</span></label>
              <div class="grid-2">
                ${field('consent.signedBy', 'Type your full name as signature', 'text', false, data.consent?.signedBy || [personal.firstName || nameParts.firstName, personal.middleInitial || nameParts.middleInitial, personal.lastName || nameParts.lastName].filter(Boolean).join(' ') || medicalCase.patientName || '')}
                ${field('consent.signedAt', 'Date signed', 'date', false, data.consent?.signedAt?.slice(0, 10) || '')}
              </div>
              <input name="consent.signatureDataUrl" type="hidden" value="${escapeHtml(data.consent?.signatureDataUrl || '')}">
              <div class="field">
                <label>Draw signature</label>
                <canvas id="patientSignaturePad" class="signature-pad" width="640" height="180"></canvas>
                <div class="toolbar">
                  <button class="secondary-btn" type="button" data-action="clear-patient-signature" ${canPatientEdit ? '' : 'disabled'}>Clear signature</button>
                  <button class="secondary-btn" type="button" data-action="use-patient-typed-signature" ${canPatientEdit ? '' : 'disabled'}>Use typed name</button>
                </div>
              </div>
            </div>
          </section>
          <section class="tab-panel" data-tab-panel="1">
            <div class="form-section">
              <h3>Family history</h3>
              <div class="muted">Add health details for close relatives. Mother and father are included by default.</div>
              <div class="responsive-table family-history-table" data-family-relatives>
                <div class="family-history-row family-history-head">
                  <strong>Relative</strong>
                  <strong>Age, if alive</strong>
                  <strong>State of health or cause of death</strong>
                  <strong>Age at death</strong>
                  <strong>Action</strong>
                </div>
                ${renderFamilyRelativeRows(data.familyHistory?.relatives)}
              </div>
              <button class="secondary-btn compact-btn" type="button" data-action="add-family-relative">Add relative</button>
            </div>
            <div class="form-section">
              <h3>Family illnesses or disorders</h3>
              <div class="muted">Have members of your family had the following illnesses or disorders?</div>
              <div class="responsive-table family-disorder-table">
                <div class="family-disorder-row family-history-head">
                  <strong>Illness or disorder</strong>
                  <strong>Answer</strong>
                  <strong>Who?</strong>
                </div>
                ${renderFamilyDisorderRows(data.familyHistory?.disorders, data.familyHistory)}
              </div>
              ${textarea('familyHistory.notes', 'Family history notes', data.familyHistory?.notes || '')}
            </div>
          </section>
          <section class="tab-panel" data-tab-panel="2">
            <div class="form-section">
              <h3>Medical history</h3>
              <div class="notice is-quiet">Each question requires a specific answer (yes, no, date, etc.); to leave a blank or draw a line is not sufficient. If the questionnaire is not fully completed and enquiries are therefore needed, time may be lost.</div>
            </div>
            <div class="form-section">
              <h3>Diseases or disorders</h3>
              <div class="muted">Have you suffered from any of the following diseases or disorders? Check yes or no. If yes, state the year.</div>
              <div class="medical-disease-two-col">
                ${renderMedicalDiseaseRows(data.medicalHistory?.diseases)}
              </div>
            </div>
            <div class="form-section">
              <h3>Additional medical questions</h3>
              <div class="medical-question-list">
                ${renderMedicalQuestionRows(data.medicalHistory?.questions, data.medicalHistory)}
              </div>
              ${textarea('medicalHistory.notes', 'Additional notes', data.medicalHistory?.notes || '')}
            </div>
            ${renderCustomFields('patient', data.customFields || {})}
            <div class="form-section">
              <h3>Select medical office</h3>
              <div class="field medical-office-field">
                <label for="patientAssignedDoctor">Medical office</label>
                <select id="patientAssignedDoctor" name="assignedClinicianId" ${canPatientEdit ? 'required' : 'disabled'}>
                  <option value="">Choose medical office</option>
                  ${state.clinicians.filter(isDoctorOfficeUser).map((doctor) => `<option value="${escapeHtml(doctor.id)}" ${medicalCase.assignedClinicianId === doctor.id ? 'selected' : ''}>${escapeHtml(doctor.displayName)} - ${escapeHtml(doctor.email)}</option>`).join('')}
                </select>
                <div class="medical-office-detail" data-medical-office-detail></div>
              </div>
            </div>
          </section>
          <div id="patientCaseMessage" class="notice is-quiet" role="status"></div>
          <div class="patient-form-footer">
            ${canPatientEdit ? `
              <div class="save-progress">
                <button class="secondary-btn" type="button" data-action="save-patient-case">Save</button>
                <span class="muted">Saves your progress and the details entered so far.</span>
              </div>
              <div class="toolbar">
                <button class="secondary-btn" type="button" data-action="patient-prev-tab" hidden>Previous</button>
                <button class="primary-btn" type="button" data-action="patient-next-tab">Next</button>
                <button class="primary-btn" id="submitPatientCase" type="submit" hidden>Submit to medical office</button>
              </div>
            ` : '<span class="muted">This medical case is no longer waiting for your action.</span>'}
          </div>
        </div>
      </div>
    </form>
  `;
}

function familyRelativeOptions() {
  return ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Child', 'Other'];
}

function defaultFamilyRelatives() {
  return [
    { relationship: 'Father', age: '', stateOfHealth: '', ageAtDeath: '', isDefault: true },
    { relationship: 'Mother', age: '', stateOfHealth: '', ageAtDeath: '', isDefault: true }
  ];
}

function familyDisorderCatalog() {
  return [
    { key: 'highBloodPressure', label: 'High Blood Pressure' },
    { key: 'heartDisease', label: 'Heart Disease' },
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'tuberculosis', label: 'Tuberculosis' },
    { key: 'asthma', label: 'Asthma' },
    { key: 'cancer', label: 'Cancer' },
    { key: 'epilepsy', label: 'Epilepsy' },
    { key: 'mentalDisorders', label: 'Mental Disorders' },
    { key: 'paralysis', label: 'Paralysis' }
  ];
}

function medicalDiseaseCatalog() {
  return [
    'Frequent sore throats',
    'Heart and blood vessel disease',
    'Urinary disorder',
    'Fainting spells',
    'Hay Fever (Allergic Rhinitis)',
    'Pains in the heart region',
    'Kidney trouble',
    'Epilepsy',
    'Asthma',
    'Varicose veins',
    'Kidney stones',
    'Diabetes',
    'Tuberculosis',
    'Frequent indigestion',
    'Back pain',
    'Rheumatic fever',
    'Pneumonia',
    'Ulcer of stomach or duodenum',
    'Joint problems',
    'Frequent headaches',
    'High blood pressure',
    'Jaundice',
    'Skin disease',
    'Any nervous or mental disorder',
    'Repeated bronchitis',
    'Gall stones',
    'Sleeplessness',
    'Chikungunya'
  ].map((label) => ({ key: disorderKey(label), label }));
}

function medicalQuestionCatalog() {
  return [
    { key: 'currentTreatment', question: 'Are you being treated for any condition now?', detailLabel: 'Describe' },
    { key: 'hospitalized', question: 'Have you ever been hospitalized (hospital, clinic, etc.)?', detailLabel: 'Why, where and when?' },
    { key: 'workAbsence', question: 'Have you ever been absent from work for longer than two weeks through illness?', detailLabel: 'If so, when and for what illness?' },
    { key: 'neurologyPsychiatry', question: 'Have you ever consulted a neurologist, a psychiatrist or a psychoanalyst?', detailLabel: 'Name and address', extraFields: [{ key: 'reason', label: 'Reason' }, { key: 'consultationDate', label: 'Date of consultation', type: 'date' }] },
    { key: 'regularMedicine', question: 'Are you taking any medicine regularly?', detailLabel: 'If so, which?' },
    { key: 'refusedEmployment', question: 'Have you ever been refused employment on health grounds?', detailLabel: 'If so, state reason' },
    { key: 'smoking', question: 'Do you smoke regularly?', detailLabel: 'What do you smoke?', extraFields: [{ key: 'years', label: 'For how many years have you smoked?' }, { key: 'frequencyPerDay', label: 'Frequency per day?' }] },
    { key: 'alcohol', question: 'Daily consumption of alcoholic beverages', type: 'text' },
    { key: 'futureTreatment', question: 'Has any doctor or dentist advised you to undergo medical or surgical treatment in the foreseeable future?', detailLabel: 'Give details' },
    { key: 'otherHealthInfo', question: 'Give any other significant information concerning your health', type: 'textarea' }
  ];
}

function normalizeFamilyRelatives(relatives) {
  const rows = Array.isArray(relatives) && relatives.length
    ? relatives
    : defaultFamilyRelatives();
  return rows.map((row, index) => ({
    relationship: row?.relationship || (index === 0 ? 'Father' : index === 1 ? 'Mother' : ''),
    age: row?.age || '',
    stateOfHealth: row?.stateOfHealth || '',
    ageAtDeath: row?.ageAtDeath || '',
    isDefault: Boolean(row?.isDefault) || index < 2
  }));
}

function normalizeFamilyDisorders(savedDisorders, legacyHistory = {}) {
  const savedByKey = new Map(
    (Array.isArray(savedDisorders) ? savedDisorders : [])
      .map((item) => [item.key || disorderKey(item.name), item])
  );
  return familyDisorderCatalog().map((item) => {
    const saved = savedByKey.get(item.key);
    return {
      key: item.key,
      name: item.label,
      answer: saved?.answer || saved?.hasCondition || (legacyHistory[item.key] ? 'yes' : ''),
      who: saved?.who || ''
    };
  });
}

function disorderKey(name) {
  return String(name || '')
    .trim()
    .replace(/[^a-z0-9]+(.)/gi, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

function renderFamilyRelativeRows(relatives) {
  return normalizeFamilyRelatives(relatives).map((row) => familyRelativeRow(row)).join('');
}

function familyRelativeRow(row = {}) {
  const options = familyRelativeOptions()
    .map((option) => `<option value="${escapeHtml(option)}" ${row.relationship === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
    .join('');
  return `
    <div class="family-history-row" data-family-relative-row>
      <select data-family-relative-field="relationship" aria-label="Relative">
        <option value="">Select</option>
        ${options}
      </select>
      <input data-family-relative-field="age" type="number" min="0" max="130" inputmode="numeric" value="${escapeHtml(row.age || '')}" aria-label="Age if alive">
      <input data-family-relative-field="stateOfHealth" type="text" value="${escapeHtml(row.stateOfHealth || '')}" aria-label="State of health or cause of death">
      <input data-family-relative-field="ageAtDeath" type="number" min="0" max="130" inputmode="numeric" value="${escapeHtml(row.ageAtDeath || '')}" aria-label="Age at death">
      <button class="secondary-btn compact-btn" type="button" data-action="remove-family-relative" ${row.isDefault ? 'disabled' : ''}>Remove</button>
    </div>
  `;
}

function renderFamilyDisorderRows(savedDisorders, legacyHistory) {
  return normalizeFamilyDisorders(savedDisorders, legacyHistory).map((row) => `
    <div class="family-disorder-row" data-family-disorder-row data-disorder-key="${escapeHtml(row.key)}" data-disorder-name="${escapeHtml(row.name)}">
      <strong>${escapeHtml(row.name)}</strong>
      <select data-family-disorder-field="answer" aria-label="${escapeHtml(row.name)} answer" required>
        <option value="">Select</option>
        <option value="yes" ${row.answer === 'yes' ? 'selected' : ''}>Yes</option>
        <option value="no" ${row.answer === 'no' ? 'selected' : ''}>No</option>
      </select>
      <input data-family-disorder-field="who" type="text" value="${escapeHtml(row.who || '')}" placeholder="Relationship or names" aria-label="${escapeHtml(row.name)} who">
    </div>
  `).join('');
}

function normalizeMedicalDiseases(savedDiseases) {
  const savedByKey = new Map((Array.isArray(savedDiseases) ? savedDiseases : []).map((item) => [item.key || disorderKey(item.name), item]));
  return medicalDiseaseCatalog().map((item) => {
    const saved = savedByKey.get(item.key);
    return {
      key: item.key,
      name: item.label,
      answer: saved?.answer || '',
      year: saved?.year || ''
    };
  });
}

function renderMedicalDiseaseRows(savedDiseases) {
  const rows = normalizeMedicalDiseases(savedDiseases);
  const midpoint = Math.ceil(rows.length / 2);
  return [rows.slice(0, midpoint), rows.slice(midpoint)].map((column) => `
    <div class="responsive-table medical-disease-table">
      <div class="medical-disease-row medical-history-head">
        <strong>Disease or disorder</strong>
        <strong>Answer</strong>
        <strong>Year</strong>
      </div>
      ${column.map((row) => `
        <div class="medical-disease-row" data-medical-disease-row data-disease-key="${escapeHtml(row.key)}" data-disease-name="${escapeHtml(row.name)}">
          ${escapeHtml(row.name)}
          <select data-medical-disease-field="answer" data-controls-year aria-label="${escapeHtml(row.name)} answer" required>
            <option value="">Select</option>
            <option value="yes" ${row.answer === 'yes' ? 'selected' : ''}>Yes</option>
            <option value="no" ${row.answer === 'no' ? 'selected' : ''}>No</option>
          </select>
          <input data-medical-disease-field="year" type="number" min="1900" max="2100" inputmode="numeric" value="${escapeHtml(row.year || '')}" placeholder="YYYY" aria-label="${escapeHtml(row.name)} year" ${row.answer === 'yes' ? 'required' : 'hidden disabled'}>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function normalizeMedicalQuestions(savedQuestions, legacy = {}) {
  const savedByKey = new Map((Array.isArray(savedQuestions) ? savedQuestions : []).map((item) => [item.key, item]));
  const legacyValues = {
    currentTreatment: legacy.chronicConditions,
    hospitalized: legacy.hospitalizations,
    regularMedicine: legacy.medications,
    otherHealthInfo: legacy.notes
  };
  return medicalQuestionCatalog().map((item) => {
    const saved = savedByKey.get(item.key) || {};
    const legacyDetail = legacyValues[item.key] || '';
    return {
      ...item,
      answer: saved.answer || (legacyDetail && item.type !== 'text' && item.type !== 'textarea' ? 'yes' : ''),
      detail: saved.detail || legacyDetail || '',
      value: saved.value || legacyDetail || '',
      extras: saved.extras || {}
    };
  });
}

function renderMedicalQuestionRows(savedQuestions, legacyHistory) {
  return normalizeMedicalQuestions(savedQuestions, legacyHistory).map((row, index) => {
    if (row.type === 'text') {
      return `
        <div class="medical-question" data-medical-question-row data-question-key="${escapeHtml(row.key)}" data-question-type="text">
          <label>${index + 2}. ${escapeHtml(row.question)}</label>
          <input data-medical-question-field="value" type="text" value="${escapeHtml(row.value || '')}" required>
        </div>
      `;
    }
    if (row.type === 'textarea') {
      return `
        <div class="medical-question" data-medical-question-row data-question-key="${escapeHtml(row.key)}" data-question-type="textarea">
          <label>${index + 2}. ${escapeHtml(row.question)}</label>
          <textarea data-medical-question-field="value" required>${escapeHtml(row.value || '')}</textarea>
        </div>
      `;
    }
    return `
      <div class="medical-question" data-medical-question-row data-question-key="${escapeHtml(row.key)}" data-question-type="yes-no">
        <div class="medical-question-main">
          <label>${index + 2}. ${escapeHtml(row.question)}</label>
          <select data-medical-question-field="answer" data-controls-details required>
            <option value="">Select</option>
            <option value="yes" ${row.answer === 'yes' ? 'selected' : ''}>Yes</option>
            <option value="no" ${row.answer === 'no' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div class="conditional-details" ${row.answer === 'yes' ? '' : 'hidden'}>
          <div class="field">
            <label>${escapeHtml(row.detailLabel || 'Details')}</label>
            <textarea data-medical-question-field="detail" ${row.answer === 'yes' ? 'required' : ''}>${escapeHtml(row.detail || '')}</textarea>
          </div>
          ${(row.extraFields || []).map((fieldConfig) => `
            <div class="field">
              <label>${escapeHtml(fieldConfig.label)}</label>
              <input data-medical-question-extra="${escapeHtml(fieldConfig.key)}" type="${escapeHtml(fieldConfig.type || 'text')}" value="${escapeHtml(row.extras?.[fieldConfig.key] || '')}">
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function bindFamilyHistoryRows(form) {
  const container = form.querySelector('[data-family-relatives]');
  if (!container) return;
  form.querySelector('[data-action="add-family-relative"]')?.addEventListener('click', () => {
    container.insertAdjacentHTML('beforeend', familyRelativeRow({ relationship: '', isDefault: false }));
  });
  container.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-action="remove-family-relative"]');
    if (!removeButton || removeButton.disabled) return;
    removeButton.closest('[data-family-relative-row]')?.remove();
  });
}

function bindMedicalHistoryRows(form) {
  form.querySelectorAll('[data-controls-year]').forEach((select) => {
    const update = () => {
      const row = select.closest('[data-medical-disease-row]');
      const year = row?.querySelector('[data-medical-disease-field="year"]');
      if (!year) return;
      const show = select.value === 'yes';
      year.hidden = !show;
      year.disabled = !show;
      year.required = show;
      if (!show) year.value = '';
    };
    select.addEventListener('change', update);
    update();
  });
  form.querySelectorAll('[data-controls-details]').forEach((select) => {
    const update = () => {
      const row = select.closest('[data-medical-question-row]');
      const details = row?.querySelector('.conditional-details');
      if (!details) return;
      const show = select.value === 'yes';
      details.hidden = !show;
      details.querySelectorAll('input, textarea').forEach((field) => {
        field.disabled = !show;
        field.required = show && field.matches('[data-medical-question-field="detail"]');
        if (!show) field.value = '';
      });
    };
    select.addEventListener('change', update);
    update();
  });
}

function collectFamilyRelatives(form) {
  return [...form.querySelectorAll('[data-family-relative-row]')]
    .map((row) => ({
      relationship: row.querySelector('[data-family-relative-field="relationship"]')?.value || '',
      age: row.querySelector('[data-family-relative-field="age"]')?.value || '',
      stateOfHealth: row.querySelector('[data-family-relative-field="stateOfHealth"]')?.value || '',
      ageAtDeath: row.querySelector('[data-family-relative-field="ageAtDeath"]')?.value || ''
    }))
    .filter((row) => row.relationship || row.age || row.stateOfHealth || row.ageAtDeath);
}

function collectFamilyDisorders(form) {
  return [...form.querySelectorAll('[data-family-disorder-row]')]
    .map((row) => ({
      key: row.dataset.disorderKey || '',
      name: row.dataset.disorderName || '',
      answer: row.querySelector('[data-family-disorder-field="answer"]')?.value || '',
      who: row.querySelector('[data-family-disorder-field="who"]')?.value || ''
    }));
}

function collectMedicalDiseases(form) {
  return [...form.querySelectorAll('[data-medical-disease-row]')]
    .map((row) => ({
      key: row.dataset.diseaseKey || '',
      name: row.dataset.diseaseName || '',
      answer: row.querySelector('[data-medical-disease-field="answer"]')?.value || '',
      year: row.querySelector('[data-medical-disease-field="year"]')?.value || ''
    }));
}

function collectMedicalQuestions(form) {
  return [...form.querySelectorAll('[data-medical-question-row]')]
    .map((row) => {
      const type = row.dataset.questionType || 'yes-no';
      const item = {
        key: row.dataset.questionKey || '',
        type,
        answer: row.querySelector('[data-medical-question-field="answer"]')?.value || '',
        detail: row.querySelector('[data-medical-question-field="detail"]')?.value || '',
        value: row.querySelector('[data-medical-question-field="value"]')?.value || '',
        extras: {}
      };
      row.querySelectorAll('[data-medical-question-extra]').forEach((field) => {
        item.extras[field.dataset.medicalQuestionExtra] = field.value || '';
      });
      return item;
    });
}

function bindPatientCaseForm() {
  const form = document.querySelector('#patientCaseForm');
  if (!form || !state.selectedCase) return;
  bindTabs(form);
  bindPhoneFormatting(form);
  bindFamilyHistoryRows(form);
  bindMedicalHistoryRows(form);
  bindPatientFormNavigation(form);
  bindMedicalOfficeDetails(form);
  setPatientCaseEditability(form, state.selectedCase.status === 'sent_to_patient');
  applyFormTemplate(form, 'patient');
  bindPatientSignaturePad(form);
  bindPatientSubmitGate(form);
  document.querySelector('[data-action="back-my-medicals"]')?.addEventListener('click', () => {
    state.selectedCase = null;
    renderShell();
  });
  document.querySelector('[data-action="save-patient-case"]')?.addEventListener('click', async () => {
    await savePatientCase(form, false);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validatePatientCaseBeforeSubmit(form)) return;
    await savePatientCase(form, true);
  });
}

function setActiveTab(form, index) {
  form.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === String(index));
  });
  form.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.tabPanel === String(index));
  });
  updatePatientFormNavigation(form);
}

function activePatientTab(form) {
  return Number(form.querySelector('[data-tab].is-active')?.dataset.tab || 0);
}

function bindPatientFormNavigation(form) {
  form.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => updatePatientFormNavigation(form));
  });
  form.querySelector('[data-action="patient-prev-tab"]')?.addEventListener('click', () => {
    setActiveTab(form, Math.max(0, activePatientTab(form) - 1));
  });
  form.querySelector('[data-action="patient-next-tab"]')?.addEventListener('click', () => {
    setActiveTab(form, Math.min(2, activePatientTab(form) + 1));
  });
  updatePatientFormNavigation(form);
}

function updatePatientFormNavigation(form) {
  const index = activePatientTab(form);
  const prev = form.querySelector('[data-action="patient-prev-tab"]');
  const next = form.querySelector('[data-action="patient-next-tab"]');
  const labels = ['Personal & consent', 'Family history', 'Medical history'];
  if (prev) prev.hidden = index === 0;
  if (next) next.hidden = index === 2;
  if (prev && index > 0) prev.textContent = `Previous: ${labels[index - 1]}`;
  if (next && index < labels.length - 1) next.textContent = `Next: ${labels[index + 1]}`;
  updatePatientSubmitGate(form);
}

function bindMedicalOfficeDetails(form) {
  const select = form.elements.assignedClinicianId;
  const detail = form.querySelector('[data-medical-office-detail]');
  if (!select || !detail) return;
  const update = () => {
    const doctor = state.clinicians.find((item) => item.id === select.value);
    detail.innerHTML = doctor ? renderMedicalOfficeDetail(doctor) : '<span class="muted">Select a medical office to view its details.</span>';
  };
  select.addEventListener('change', update);
  update();
}

function renderMedicalOfficeDetail(doctor) {
  const profile = doctor.medicalProfile || {};
  const rows = [
    ['Office', profile.facilityName || doctor.displayName],
    ['Address', profile.facilityAddress],
    ['Type', medicalOfficeUserTypeLabel(doctor)],
    ['Doctor / clinician', profile.clinicianName || doctor.displayName],
    ['Registration', profile.registrationNumber],
    ['Email', doctor.email]
  ].filter(([, value]) => value);
  return rows.map(([label, value]) => `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');
}

function validatePatientCaseBeforeSubmit(form) {
  const message = document.querySelector('#patientCaseMessage');
  const show = (text, tabIndex, target) => {
    if (message) {
      message.textContent = text;
      message.classList.remove('success-message');
    }
    setActiveTab(form, tabIndex);
    markPatientValidationTarget(form, target || findFirstInvalidPatientField(form, tabIndex));
    return false;
  };
  if (!form.elements['consent.accepted']?.checked || !form.elements['consent.signatureDataUrl']?.value || !form.elements['consent.signedAt']?.value) {
    return show('The disclosure, consent, and signature section is not complete.', 0, form.elements['consent.accepted']);
  }
  const missingFamily = [...form.querySelectorAll('[data-family-disorder-field="answer"]')].find((field) => !field.value);
  if (missingFamily) return show('The family illnesses or disorders section is not complete.', 1, missingFamily);
  const missingDisease = [...form.querySelectorAll('[data-medical-disease-row]')].find((row) => {
    const answer = row.querySelector('[data-medical-disease-field="answer"]')?.value;
    const year = row.querySelector('[data-medical-disease-field="year"]')?.value;
    return !answer || (answer === 'yes' && !year);
  });
  if (missingDisease) return show('The diseases or disorders section is not complete. Add a year for each Yes answer.', 2, missingDisease);
  if (!form.elements.assignedClinicianId?.value) {
    return show('The medical office section is not complete. Choose the office that will complete your assessment.', 2, form.elements.assignedClinicianId);
  }
  const invalid = findFirstInvalidPatientField(form);
  if (invalid) {
    const tabIndex = Number(invalid.closest('[data-tab-panel]')?.dataset.tabPanel || 0);
    setActiveTab(form, tabIndex);
    const label = form.querySelector(`[data-tab="${tabIndex}"]`)?.textContent?.trim() || 'This section';
    if (message) {
      message.textContent = `${label} is not complete. Please review the highlighted section.`;
      message.classList.remove('success-message');
    }
    markPatientValidationTarget(form, invalid);
    return false;
  }
  return true;
}

function findFirstInvalidPatientField(form, tabIndex = null) {
  const root = tabIndex === null ? form : form.querySelector(`[data-tab-panel="${tabIndex}"]`);
  if (!root) return null;
  return [...root.querySelectorAll('input, select, textarea')]
    .find((field) => field.willValidate && !field.checkValidity());
}

function markPatientValidationTarget(form, target) {
  form.querySelectorAll('.is-validation-target').forEach((item) => item.classList.remove('is-validation-target'));
  const element = target?.closest?.('.form-section') || target?.closest?.('[data-family-disorder-row], [data-medical-disease-row], [data-medical-question-row]') || target;
  element?.classList?.add('is-validation-target');
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  target?.reportValidity?.();
  if (target?.focus && target.type !== 'hidden') target.focus({ preventScroll: true });
}

function bindPatientSubmitGate(form) {
  const update = () => updatePatientSubmitGate(form);
  ['consent.accepted', 'consent.signedBy', 'consent.signatureDataUrl', 'assignedClinicianId'].forEach((name) => {
    const field = form.elements[name];
    if (!field) return;
    field.addEventListener('input', update);
    field.addEventListener('change', update);
  });
  update();
}

function bindPhoneFormatting(root) {
  root.querySelectorAll('[data-phone-input]').forEach((input) => {
    input.value = formatPhone(input.value);
    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
    });
    input.addEventListener('keydown', (event) => {
      const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
      if (!/^\d$/.test(event.key)) event.preventDefault();
    });
  });
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function updatePatientSubmitGate(form) {
  const submit = form.querySelector('#submitPatientCase');
  if (!submit) return;
  const isFinalTab = activePatientTab(form) === 2;
  const hasOffice = Boolean(form.elements.assignedClinicianId?.value);
  const hasSignature = Boolean(form.elements['consent.signatureDataUrl']?.value && form.elements['consent.signedBy']?.value);
  const hasConsent = Boolean(form.elements['consent.accepted']?.checked);
  submit.hidden = !isFinalTab;
  submit.disabled = false;
  submit.title = !(hasOffice && hasSignature && hasConsent) ? 'Complete consent, signature, and medical office selection before submitting.' : '';
}

function setPatientCaseEditability(form, canEdit) {
  if (canEdit) return;
  form.querySelectorAll('input, textarea, select, button[data-action="add-family-relative"], button[data-action="remove-family-relative"]').forEach((field) => {
    if (field.type === 'hidden') return;
    if (field.tagName === 'SELECT' || field.tagName === 'BUTTON' || field.type === 'checkbox') field.disabled = true;
    else field.readOnly = true;
  });
}

function bindPatientSignaturePad(form) {
  const canvas = form.querySelector('#patientSignaturePad');
  if (!canvas || !window.LocalSignaturePad) return;
  const pad = new window.LocalSignaturePad(canvas);
  const hidden = form.elements['consent.signatureDataUrl'];
  const date = form.elements['consent.signedAt'];
  if (hidden.value) pad.fromDataUrl(hidden.value);
  if (date) date.readOnly = true;
  const markSigned = () => {
    hidden.value = pad.toDataUrl();
    if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };
  canvas.addEventListener('pointerup', markSigned);
  form.querySelector('[data-action="clear-patient-signature"]')?.addEventListener('click', () => {
    pad.clear();
    hidden.value = '';
    if (date) date.value = '';
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  });
  form.querySelector('[data-action="use-patient-typed-signature"]')?.addEventListener('click', () => {
    drawTypedSignature(canvas, form.elements['consent.signedBy'].value || state.selectedCase.patientName || state.user.displayName);
    hidden.value = canvas.toDataURL('image/png');
    if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function savePatientCase(form, submit) {
  if (submit) {
    const consent = patientCaseFormData(form).consent;
    if (!form.elements.assignedClinicianId?.value && !state.selectedCase.assignedClinicianId) {
      document.querySelector('#patientCaseMessage').textContent = 'Choose the medical office that will complete your assessment.';
      return;
    }
    if (!consent.accepted || !consent.signedBy || !consent.signatureDataUrl || !consent.signedAt) {
      document.querySelector('#patientCaseMessage').textContent = 'Read the disclosure, accept consent, and sign before submitting.';
      return;
    }
  }
  const doctor = state.clinicians.find((item) => item.id === form.elements.assignedClinicianId?.value);
  const response = await api(`/api/cases/${encodeURIComponent(state.selectedCase.id)}`, {
    method: 'PATCH',
    body: {
      intent: submit ? 'submit' : 'draft',
      patientCaseData: patientCaseFormData(form),
      assignedClinicianId: submit ? (form.elements.assignedClinicianId?.value || state.selectedCase.assignedClinicianId || '') : undefined,
      assignedClinicianName: doctor?.displayName || state.selectedCase.assignedClinicianName || ''
    }
  });
  state.selectedCase = response.case;
  const message = document.querySelector('#patientCaseMessage');
  message.textContent = submit ? 'Submitted. Your case has been sent to the selected medical office.' : 'Draft saved.';
  message.classList.add('success-message');
  if (submit) {
    await loadMyMedicalCases();
  }
}

function patientCaseFormData(form) {
  const data = new FormData(form);
  return {
    personalInfo: collect(data, 'personalInfo', ['firstName', 'middleInitial', 'lastName', 'sex', 'maritalStatus', 'addressLine1', 'addressLine2', 'cityTown', 'parish', 'country', 'homePhone', 'mobilePhone', 'workPhone', 'emergencyContactName', 'emergencyContactNumber', 'primaryPhysician', 'primaryPhysicianAddress', 'primaryPhysicianPhone']),
    consent: {
      accepted: data.has('consent.accepted'),
      signedBy: data.get('consent.signedBy') || '',
      signedAt: data.get('consent.signedAt') || '',
      signatureDataUrl: data.get('consent.signatureDataUrl') || ''
    },
    familyHistory: {
      relatives: collectFamilyRelatives(form),
      disorders: collectFamilyDisorders(form),
      notes: data.get('familyHistory.notes') || ''
    },
    medicalHistory: {
      diseases: collectMedicalDiseases(form),
      questions: collectMedicalQuestions(form),
      notes: data.get('medicalHistory.notes') || ''
    },
    customFields: collectCustomFields(form)
  };
}

function renderTrackingRows() {
  if (!state.monthlyReport.length) return '<div class="empty">No assigned candidates yet.</div>';
  return `
    <div class="tracking-row tracking-head">
      <strong>Month</strong>
      <strong>Doctor</strong>
      <strong>Assigned candidates</strong>
      <strong>Submitted forms</strong>
      <strong>Due</strong>
    </div>
    ${state.monthlyReport.map((row) => `
      <div class="tracking-row">
        <span>${escapeHtml(row.month)}</span>
        <strong>${escapeHtml(row.doctorName)}</strong>
        <span>${escapeHtml(row.assignedCount)}</span>
        <span>${escapeHtml(row.submittedCount)}</span>
        <strong>${escapeHtml(formatCurrency(row.dueAmount || 0))}</strong>
      </div>
    `).join('')}
  `;
}

function renderCandidateRows() {
  if (!state.candidates.length) return '<div class="empty">No new hire profiles yet.</div>';
  return `
    <div class="user-row user-row-head candidate-row">
      <strong>Candidate</strong>
      <strong>Doctor</strong>
      <strong>Status</strong>
      <strong>Action</strong>
    </div>
    ${state.candidates.map((candidate) => `
      <form class="user-row candidate-row" data-candidate-id="${escapeHtml(candidate.id)}">
        <div>
          <strong>${escapeHtml(candidate.fullName)}</strong>
          <div class="muted">${escapeHtml(candidate.employeeId || 'No applicant ID')} · ${escapeHtml(candidate.position || 'No position')}</div>
        </div>
        <div>${escapeHtml(candidate.assignedClinicianName || 'Unassigned')}</div>
        <div class="field">
          <label class="sr-only" for="candidate-status-${escapeHtml(candidate.id)}">Status</label>
          <select id="candidate-status-${escapeHtml(candidate.id)}" name="status">
            ${['assigned', 'submitted', 'archived'].map((status) => `
              <option value="${status}" ${candidate.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>
            `).join('')}
          </select>
        </div>
        <div class="candidate-actions">
          <button class="secondary-btn" type="submit">Save</button>
        </div>
      </form>
    `).join('')}
  `;
}

function renderReviewerRows() {
  if (!state.reviewers.length) return '<div class="empty">No reviewers loaded.</div>';
  return `
    <div class="user-row user-row-head reviewer-row">
      <strong>Reviewer</strong>
      <strong>Role</strong>
      <strong>Status</strong>
    </div>
    ${state.reviewers.map((reviewer) => `
      <div class="user-row reviewer-row">
        <div>
          <strong>${escapeHtml(reviewer.displayName)}</strong>
          <div class="muted">${escapeHtml(reviewer.email)}</div>
        </div>
        <span>${escapeHtml(roleLabel(reviewer.role))}</span>
        <span class="status reviewed">${reviewer.active ? 'Active' : 'Inactive'}</span>
      </div>
    `).join('')}
  `;
}

function bindCandidateRows() {
  document.querySelectorAll('[data-candidate-id]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      await api(`/api/candidates/${encodeURIComponent(form.dataset.candidateId)}`, {
        method: 'PATCH',
        body: {
          status: data.get('status')
        }
      });
      await loadSetupData();
    });
  });
}

function formToSubmission(form) {
  const data = new FormData(form);
  return {
    candidate: collect(data, 'candidate', ['candidateId', 'caseId', 'patientId', 'fullName', 'employeeId', 'nationalId', 'dateOfBirth', 'email', 'contactNumber', 'position']),
    assessment: collect(data, 'assessment', ['facilityName', 'facilityAddress', 'assessmentDate', 'clinicianName', 'clinicianRegistrationNumber', 'telephoneNumber', 'faxNumber', 'emailAddress']),
    vitals: {
      heightCm: data.get('physicalExam.height') || '',
      weightKg: data.get('physicalExam.weight') || '',
      bloodPressure: data.get('physicalExam.bloodPressure') || '',
      pulse: data.get('physicalExam.pulseRate') || '',
      vision: '',
      hearing: '',
      urine: ''
    },
    medicalHistory: {
      cardiac: data.has('medicalHistory.cardiac'),
      respiratory: data.has('medicalHistory.respiratory'),
      diabetes: data.has('medicalHistory.diabetes'),
      hypertension: data.has('medicalHistory.hypertension'),
      allergies: data.has('medicalHistory.allergies'),
      surgeries: data.has('medicalHistory.surgeries'),
      medications: data.has('medicalHistory.medications'),
      mentalHealth: data.has('medicalHistory.mentalHealth'),
      infectiousDisease: data.has('medicalHistory.infectiousDisease'),
      notes: data.get('medicalHistory.notes') || ''
    },
    familyHistory: {
      hypertension: data.has('familyHistory.hypertension'),
      diabetes: data.has('familyHistory.diabetes'),
      heartDisease: data.has('familyHistory.heartDisease'),
      asthma: data.has('familyHistory.asthma'),
      cancer: data.has('familyHistory.cancer'),
      stroke: data.has('familyHistory.stroke'),
      kidneyDisease: data.has('familyHistory.kidneyDisease'),
      mentalHealth: data.has('familyHistory.mentalHealth'),
      notes: data.get('familyHistory.notes') || ''
    },
    physicalExam: collect(data, 'physicalExam', physicianExamFieldKeys),
    labResults: collect(data, 'labResults', ['additionalTests']),
    determination: collect(data, 'determination', ['status', 'conclusions', 'restrictions', 'recommendation', 'followUpDate']),
    customFields: collectCustomFields(form),
    attestation: {
      signedBy: data.get('attestation.signedBy') || '',
      signatureDate: data.get('attestation.signatureDate') || '',
      consentConfirmed: data.has('attestation.consentConfirmed'),
      signatureDataUrl: data.get('attestation.signatureDataUrl') || ''
    }
  };
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collect(data, prefix, keys) {
  return Object.fromEntries(keys.map((key) => [key, data.get(`${prefix}.${key}`) || '']));
}

function field(name, label, type = 'text', required = false, value = '') {
  const id = name.replace(/\./g, '-');
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <input id="${id}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${required ? 'required' : ''}>
    </div>
  `;
}

function logoUploadField(name, label, value = '', help = '') {
  const id = name.replace(/\./g, '-');
  return `
    <div class="logo-upload-card">
      <div class="logo-preview" data-logo-preview="${escapeHtml(name)}">
        ${value ? `<img src="${escapeHtml(value)}" alt="">` : '<span>NCB</span>'}
      </div>
      <div class="field">
        <label for="${id}File">${escapeHtml(label)}</label>
        <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
        <input id="${id}File" data-logo-input="${escapeHtml(name)}" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp">
        ${help ? `<div class="field-help">${escapeHtml(help)}</div>` : ''}
      </div>
      <button class="secondary-btn" type="button" data-logo-clear="${escapeHtml(name)}">Remove</button>
    </div>
  `;
}

function phoneField(name, label, value = '') {
  const id = name.replace(/\./g, '-');
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <input id="${id}" name="${escapeHtml(name)}" type="tel" inputmode="numeric" autocomplete="tel" data-phone-input pattern="\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}" maxlength="14" value="${escapeHtml(formatPhone(value))}" placeholder="(876) 555-1234">
    </div>
  `;
}

function selectField(name, label, options, value = '', required = false) {
  const id = name.replace(/\./g, '-');
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${escapeHtml(name)}" ${required ? 'required' : ''}>
        <option value="">Select</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </div>
  `;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', middleInitial: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleInitial: '', lastName: '' };
  return {
    firstName: parts[0],
    middleInitial: parts.length > 2 ? parts.slice(1, -1).map((part) => part[0]).join('') : '',
    lastName: parts[parts.length - 1]
  };
}

function textarea(name, label, value = '') {
  const id = name.replace(/\./g, '-');
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <textarea id="${id}" name="${escapeHtml(name)}">${escapeHtml(value)}</textarea>
    </div>
  `;
}

function checkbox(name, label) {
  return `
    <label class="check">
      <input name="${escapeHtml(name)}" type="checkbox">
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function checkedCheckbox(name, label, checked = false) {
  return `
    <label class="check">
      <input name="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function readonlyField(label, value = '') {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `
    <div class="field">
      <label for="readonly-${id}">${escapeHtml(label)}</label>
      <input id="readonly-${id}" value="${escapeHtml(value || '')}" readonly>
    </div>
  `;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read signature file.'));
    reader.readAsDataURL(file);
  });
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } finally {
    state.timeoutMessage = '';
    renderLogin();
  }
}

function can(permission) {
  const permissions = Array.isArray(state.user?.permissions)
    ? state.user.permissions
    : (ROLE_PERMISSIONS[state.user?.role] || []);
  return permissions.includes(permission);
}

function defaultViewForUser() {
  if (state.user?.role === ROLES.PATIENT) return 'my-medicals';
  if (state.user?.role === ROLES.DOCTOR) return 'doctor-dashboard';
  if ([ROLES.REVIEWER, ROLES.ADMIN].includes(state.user?.role)) return 'hr-dashboard';
  if (can(PERMISSIONS.SUBMISSIONS_CREATE)) return 'submit';
  if (can(PERMISSIONS.SUBMISSIONS_REVIEW)) return 'review';
  if (can(PERMISSIONS.USERS_MANAGE)) return 'admin';
  return 'my-medicals';
}

function startSessionTimers() {
  clearSessionTimers();
  if (!state.user || !state.session?.expiresAt) return;

  const expiresAt = new Date(state.session.expiresAt).getTime();
  const warningMs = Number(state.session.warningMs || 60000);
  const remainingMs = expiresAt - Date.now();
  const warnInMs = Math.max(0, remainingMs - warningMs);

  state.sessionTimers.warning = window.setTimeout(showSessionWarning, warnInMs);
  state.sessionTimers.timeout = window.setTimeout(() => {
    expireSession('Your session expired because there was no activity. Please sign in again.');
  }, Math.max(0, remainingMs));
}

function clearSessionTimers() {
  if (state.sessionTimers.warning) window.clearTimeout(state.sessionTimers.warning);
  if (state.sessionTimers.timeout) window.clearTimeout(state.sessionTimers.timeout);
  state.sessionTimers.warning = null;
  state.sessionTimers.timeout = null;
  hideSessionWarning();
}

function showSessionWarning() {
  if (!state.user || document.querySelector('#sessionWarning')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="session-warning" id="sessionWarning" role="alertdialog" aria-modal="true" aria-labelledby="sessionWarningTitle">
      <div class="session-warning-panel">
        <h2 id="sessionWarningTitle">Session expiring soon</h2>
        <p>Your session will expire in about one minute. Continue working to stay signed in.</p>
        <div class="toolbar">
          <button class="primary-btn" type="button" data-action="stay-signed-in">Stay signed in</button>
          <button class="secondary-btn" type="button" data-action="logout-now">Sign out</button>
        </div>
      </div>
    </div>
  `);
  document.querySelector('[data-action="stay-signed-in"]')?.addEventListener('click', refreshSession);
  document.querySelector('[data-action="logout-now"]')?.addEventListener('click', logout);
}

function hideSessionWarning() {
  document.querySelector('#sessionWarning')?.remove();
}

let sessionRefreshInFlight = false;

async function refreshSessionFromWarningActivity() {
  if (!document.querySelector('#sessionWarning') || sessionRefreshInFlight) return;
  await refreshSession();
}

async function refreshSession() {
  if (!state.user || sessionRefreshInFlight) return;
  sessionRefreshInFlight = true;
  try {
    const response = await api('/api/me');
    state.user = response.user;
    state.csrfToken = response.csrfToken;
    state.session = response.session || state.session;
    hideSessionWarning();
    startSessionTimers();
  } catch {
    expireSession('Your session expired. Please sign in again.');
  } finally {
    sessionRefreshInFlight = false;
  }
}

function expireSession(message) {
  if (!state.user) return;
  state.timeoutMessage = message;
  state.user = null;
  state.csrfToken = '';
  state.session = null;
  clearSessionTimers();
  renderLogin();
}

function viewTitle() {
  if (state.view === 'profile') return 'Profile';
  if (state.view === 'hr-dashboard') return 'Dashboard';
  if (state.view === 'user-management') return 'User Management';
  if (state.view === 'medical-offices') return 'Medical Office Management';
  if (state.view === 'doctor-management') return 'Doctor Management';
  if (state.view === 'report-management') return 'Report Management';
  if (state.view === 'doctor-dashboard') return 'Dashboard';
  if (state.view === 'doctor-reports') return 'Reports';
  if (state.view === 'submit') return state.user?.role === ROLES.DOCTOR ? 'Inbox medicals' : 'New assessment';
  if (state.view === 'mine') return 'Submitted records';
  if (state.view === 'admin') return 'Administration';
  if (state.view === 'setup') return 'Patient Management';
  if (state.view === 'archive') return 'Archive';
  return 'Review queue';
}

function profileSubtitle() {
  if (!state.user) return '';
  if (state.user.role === ROLES.DOCTOR) {
    const profile = state.user.medicalProfile || {};
    return profile.facilityName || profile.clinicianName || 'Medical office';
  }
  return roleLabel(state.user.role);
}

function roleLabel(role) {
  return {
    clinician: 'Medical Office User',
    reviewer: 'HR Officer',
    admin: 'Administrator',
    patient: 'Patient'
  }[role] || role;
}

function getInitials(name) {
  const parts = String(name || 'U')
    .split(/\s+/)
    .filter(Boolean);
  const initials = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts)
    .map((part) => part[0].toUpperCase())
    .join('');
  return initials.slice(0, 2) || 'U';
}

function historySummary(history) {
  const labels = {
    cardiac: 'Cardiac condition',
    respiratory: 'Respiratory condition',
    diabetes: 'Diabetes',
    hypertension: 'Hypertension',
    allergies: 'Allergies',
    surgeries: 'Previous surgeries',
    medications: 'Current medications',
    mentalHealth: 'Mental health history',
    infectiousDisease: 'Infectious disease history'
  };
  const selected = Object.entries(labels)
    .filter(([key]) => history[key])
    .map(([, label]) => label);
  return selected.length ? selected.join(', ') : 'No selected history items';
}

function familyHistorySummary(history) {
  if (Array.isArray(history?.disorders)) {
    const selected = history.disorders
      .filter((item) => item.answer === 'yes' || item.hasCondition === 'yes')
      .map((item) => item.who ? `${item.name} (${item.who})` : item.name)
      .filter(Boolean);
    return selected.length ? selected.join(', ') : 'No selected family history items';
  }
  const labels = {
    hypertension: 'High blood pressure / hypertension',
    diabetes: 'Diabetes',
    heartDisease: 'Heart disease',
    asthma: 'Asthma or chronic breathing illness',
    cancer: 'Cancer',
    stroke: 'Stroke',
    kidneyDisease: 'Kidney disease',
    mentalHealth: 'Mental health condition'
  };
  const selected = Object.entries(labels)
    .filter(([key]) => history?.[key])
    .map(([, label]) => label);
  return selected.length ? selected.join(', ') : 'No selected family history items';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
