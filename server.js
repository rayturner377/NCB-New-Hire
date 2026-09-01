'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { databaseConfig, databaseConfigFromSettings, initializeDatabase } = require('./database');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SUBMISSION_DIR = path.join(DATA_DIR, 'submissions');
const CANDIDATE_DIR = path.join(DATA_DIR, 'candidates');
const CASE_DIR = path.join(DATA_DIR, 'cases');
const ATTACHMENT_DIR = path.join(DATA_DIR, 'attachments');
const MEDICAL_OFFICES_PATH = path.join(DATA_DIR, 'medical-offices.json');
const REPORT_CASE_INDEX_PATH = path.join(DATA_DIR, 'case-report-index.json');
const REPORT_PATIENT_INDEX_PATH = path.join(DATA_DIR, 'patient-report-index.json');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const MASTER_KEY_PATH = path.join(DATA_DIR, 'master.key');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'audit.log');
const NOTIFICATION_LOG_PATH = path.join(DATA_DIR, 'notifications.log');
const BOOTSTRAP_PATH = path.join(DATA_DIR, 'bootstrap-credentials.txt');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

const env = loadEnv(path.join(ROOT_DIR, '.env'));
let configuredDatabase = databaseConfig(env);
const config = {
  appName: env.APP_NAME || 'National Commercial Bank Jamaica Medical Platform',
  host: env.HOST || '127.0.0.1',
  port: Number.parseInt(env.PORT || '8080', 10),
  publicUrl: env.PUBLIC_URL || 'http://localhost:8080',
  cookieSecure: stringToBool(env.COOKIE_SECURE),
  maxBodyBytes: 6 * 1024 * 1024,
  sessionTtlMs: parseSessionTimeoutMs(env.SESSION_TIMEOUT_MINUTES, 15),
  sessionWarningMs: 60 * 1000,
  reviewNotificationEmail: env.REVIEW_NOTIFICATION_EMAIL || '',
  fromEmail: env.FROM_EMAIL || 'no-reply@localhost',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number.parseInt(env.SMTP_PORT || '587', 10),
    secure: stringToBool(env.SMTP_SECURE),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    rejectUnauthorized: env.SMTP_REJECT_UNAUTHORIZED !== 'false'
  }
};

ensurePrivateDirectory(DATA_DIR);
ensurePrivateDirectory(SUBMISSION_DIR);
ensurePrivateDirectory(CANDIDATE_DIR);
ensurePrivateDirectory(CASE_DIR);
ensurePrivateDirectory(ATTACHMENT_DIR);

const masterKey = loadMasterKey();
const sessions = new Map();
const loginAttempts = new Map();
const passwordResetTokens = new Map();
let usersCache = null;
let usersMutationQueue = Promise.resolve();
let settingsCache = null;
let caseReportIndexCache = null;
let patientReportIndexCache = null;
let database = { enabled: false, dialect: '', close: async () => {} };

const defaultSettings = {
  organizationName: 'National Commercial Bank Jamaica Limited',
  appName: 'National Commercial Bank Jamaica Medical Platform',
  clinicianIntro: 'Complete the new-hire medical assessment and submit it directly to National Commercial Bank Jamaica for confidential review.',
  reviewerIntro: 'Review submitted new-hire medical assessments, update review status, and print or file authorized forms.',
  confidentialityNotice: 'Confidential medical information. Access is restricted to authorized medical facilities and National Commercial Bank Jamaica reviewers.',
  notificationEmail: config.reviewNotificationEmail || 'hr-review@ncb.local',
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
    fromEmail: config.fromEmail
  },
  emailTemplates: {
    accountCreated: {
      subject: '{{appName}}: your account has been created',
      body: 'Hello {{displayName}},\n\nYour account for {{appName}} has been created.\n\nSign in: {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{temporaryPassword}}\n\nYou will be required to choose a new password after signing in.'
    },
    passwordReset: {
      subject: '{{appName}}: reset your password',
      body: 'Hello {{displayName}},\n\nA password reset was requested for your {{appName}} account.\n\nReset your password: {{resetUrl}}\n\nThis link expires in {{expiryMinutes}} minutes. If you did not request this change, you can ignore this email.'
    },
    medicalAssignedToPatient: {
      subject: '{{appName}}: medical form ready for completion',
      body: 'Hello {{displayName}},\n\nA medical form is ready for you in {{appName}}.\n\nSign in to review and complete it: {{loginUrl}}\n\nFor confidentiality, medical details are not included in this email.'
    }
  },
  operations: {
    auditRetentionDays: 365,
    loginWindowMinutes: 15,
    loginMaxAttempts: 5,
    sessionTimeoutMinutes: Math.round(config.sessionTtlMs / 60000),
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
};

const PHYSICIAN_EXAM_FIELD_KEYS = [
  'generalAppearance',
  'height',
  'weight',
  'nose',
  'pharynx',
  'teeth',
  'tongue',
  'tonsils',
  'thyroid',
  'pulseRate',
  'rhythm',
  'bloodPressure',
  'varicoseVeins',
  'presenceOfCyanosis',
  'mucusMembrane',
  'thorax',
  'breasts',
  'fundi',
  'reflexes',
  'sensation',
  'tremors',
  'mentalAppearance',
  'behaviour',
  'kidneys',
  'organs',
  'skull',
  'spine',
  'upperExtremities',
  'lowerExtremities',
  'disabilities',
  'pregnancyTest'
];

const FORM_TEMPLATE_ROLES = ['admin', 'reviewer', 'clinician', 'patient'];
const FORM_FIELD_TYPES = ['text', 'textarea', 'date', 'number', 'email', 'phone', 'select', 'radio', 'checkbox', 'yes_no', 'information'];

const ROLES = Object.freeze({
  ADMIN: 'admin',
  REVIEWER: 'reviewer',
  DOCTOR: 'clinician',
  PATIENT: 'patient'
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));
const MEDICAL_OFFICE_USER_TYPES = Object.freeze(['doctor', 'clinician']);

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
  MEDICAL_CASES_ATTACH: 'medical_cases:attach',
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
    PERMISSIONS.MEDICAL_CASES_ATTACH,
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
    PERMISSIONS.MEDICAL_CASES_ATTACH,
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

const CASE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SENT_TO_PATIENT: 'sent_to_patient',
  PATIENT_COMPLETED: 'patient_completed',
  SENT_TO_DOCTOR: 'sent_to_doctor',
  DOCTOR_SUBMITTED: 'doctor_submitted',
  CANCELED_BY_DOCTOR: 'canceled_by_doctor',
  REVIEW_PENDING: 'review_pending',
  REVIEWED: 'reviewed',
  ARCHIVED: 'archived',
  WITHDRAWN: 'withdrawn'
});

const CASE_ROUTES = Object.freeze({
  PATIENT: 'patient',
  DOCTOR: 'doctor'
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function main() {
  configuredDatabase = await resolveStartupDatabaseConfig();
  database = await initializeDatabase(configuredDatabase);
  await ensureUsers();
  await ensureSettings();
  await ensureDemoDoctorCase();
  await ensureWorkflowDemoCases();

  const server = http.createServer((req, res) => {
    route(req, res).catch(async (error) => {
      const status = error.status || 500;
      if (status >= 500) {
        console.error(error);
        await appendAudit('server_error', { path: req.url, message: error.message });
      }
      sendJson(res, status, { error: status >= 500 ? 'Unexpected server error.' : error.message });
    });
  });

  server.listen(config.port, config.host, () => {
    console.log(`${config.appName} is running at http://${config.host}:${config.port}`);
    console.log('Private data directory:', DATA_DIR);
    console.log('Database:', database.enabled ? `${database.dialect} connected, migrations current` : 'disabled, encrypted file storage active');
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(async () => {
      await database.close().catch((error) => console.error('Database shutdown error:', error.message));
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

async function route(req, res) {
  setSecurityHeaders(res);

  const host = req.headers.host || `localhost:${config.port}`;
  const url = new URL(req.url, `http://${host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && (pathname === '/' || pathname === '/login')) {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/styles.css') {
    return sendFile(res, path.join(PUBLIC_DIR, 'styles.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/app.js') {
    return sendFile(res, path.join(PUBLIC_DIR, 'app.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/signature-pad.js') {
    return sendFile(res, path.join(PUBLIC_DIR, 'signature-pad.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/assets/ghrd-logo.png') {
    return sendFile(res, path.join(PUBLIC_DIR, 'assets', 'ghrd-logo.png'), 'image/png');
  }

  const printMatch = pathname.match(/^\/submissions\/([a-zA-Z0-9_-]+)\/print$/);
  if (req.method === 'GET' && printMatch) {
    return handlePrint(req, res, printMatch[1]);
  }

  const downloadMatch = pathname.match(/^\/submissions\/([a-zA-Z0-9_-]+)\/download$/);
  if (req.method === 'GET' && downloadMatch) {
    return handleDownload(req, res, downloadMatch[1]);
  }

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname, url);
  }

  throw new HttpError(404, 'Not found.');
}

async function handleApi(req, res, pathname, url) {
  if (req.method === 'GET' && pathname === '/api/public-settings') {
    const settings = await readSettings();
    return sendJson(res, 200, { settings: publicSettings(settings) });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    return handleLogin(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/password-reset-request') {
    return handlePasswordResetRequest(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/password-reset-confirm') {
    return handlePasswordResetConfirm(req, res);
  }

  const auth = await requireAuth(req, res);

  if (auth.user.mustChangePassword === true && !['/api/me', '/api/change-password', '/api/logout'].includes(pathname)) {
    throw new HttpError(403, 'You must change your temporary password before continuing.');
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    verifyCsrf(req, auth.session);
  }

  requirePermission(auth.user, permissionForApiRequest(req.method, pathname));

  if (req.method === 'GET' && pathname === '/api/me') {
    return sendJson(res, 200, {
      user: publicUser(auth.user),
      csrfToken: auth.session.csrfToken,
      settings: publicSettings(await readSettings()),
      session: publicSession(auth.session)
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/me') {
    const body = await readJsonBody(req);
    const users = await readUsers();
    const user = users.find((item) => item.id === auth.user.id);
    if (!user) throw new HttpError(404, 'User not found.');
    if (body.displayName !== undefined) user.displayName = requiredText(body.displayName, 'Display name', 140);
    if (body.medicalProfile !== undefined) user.medicalProfile = sanitizeMedicalProfile(body.medicalProfile);
    await writeUsers(users);
    auth.user.displayName = user.displayName;
    auth.user.medicalProfile = user.medicalProfile;
    await appendAudit('profile_updated', { userId: auth.user.id });
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/change-password') {
    const body = await readJsonBody(req);
    const users = await readUsers();
    const user = users.find((item) => item.id === auth.user.id);
    if (!user) throw new HttpError(404, 'User not found.');
    if (!verifyPassword(String(body.currentPassword || ''), user.password)) {
      throw new HttpError(400, 'Current password is incorrect.');
    }
    const newPassword = requiredPassword(body.newPassword);
    if (verifyPassword(newPassword, user.password)) {
      throw new HttpError(400, 'New password must be different from the temporary password.');
    }
    user.password = makePasswordRecord(newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date().toISOString();
    await writeUsers(users);
    await revokeOtherUserSessions(user.id, auth.sessionId);
    await appendAudit('password_changed', { userId: user.id, forcedChange: Boolean(auth.user.mustChangePassword) });
    auth.user.mustChangePassword = false;
    return sendJson(res, 200, { message: 'Password changed successfully.', user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    sessions.delete(auth.sessionId);
    res.setHeader('Set-Cookie', clearSessionCookie());
    await appendAudit('logout', { userId: auth.user.id });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/submissions') {
    const submissions = await loadSubmissionsForUser(auth.user);
    const page = paginateApiItems(submissions.map(toSubmissionSummary), url, submissionSearchText);
    return sendJson(res, 200, { submissions: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/submissions') {
    const body = await readJsonBody(req);
    const medicalCase = await loadMedicalCaseForSubmission(body, auth.user);
    if (body.intent !== 'final') throw new HttpError(400, 'Use the draft endpoint to save incomplete medical cases.');
    assertDoctorCanSubmitFinalMedical(medicalCase, auth.user);
    const submission = sanitizeSubmission(body, auth.user);
    assertTemplateRequiredFields(await readSettings(), 'doctor', auth.user.role, submission.customFields);
    submission.caseId = medicalCase.id;
    submission.patientId = medicalCase.patientId;
    submission.candidate.candidateId = medicalCase.id;
    submission.candidate.caseId = medicalCase.id;
    submission.candidate.patientId = medicalCase.patientId;
    submission.patientCaseData = sanitizePatientCaseData(medicalCase.patientCaseData || {});
    submission.familyHistory = submission.familyHistory || submission.patientCaseData.familyHistory;
    submission.consent = submission.patientCaseData.consent;
    await saveSubmission(submission);
    await markCaseSubmitted(medicalCase, submission.id, auth.user, submission.candidate.medicationInformation);
    await appendAudit('submission_created', {
      submissionId: submission.id,
      userId: auth.user.id,
      role: auth.user.role
    });

    const notification = await notifyReviewers(submission);
    return sendJson(res, 201, {
      id: submission.id,
      notification
    });
  }

  if (req.method === 'GET' && pathname === '/api/candidates') {
    const candidates = await loadCandidatesForUser(auth.user);
    const page = paginateApiItems(candidates.map(toCandidateSummary), url, candidateSearchText);
    return sendJson(res, 200, { candidates: page.items, pagination: page.pagination });
  }

  if (req.method === 'GET' && pathname === '/api/cases') {
    const cases = hasPermission(auth.user, PERMISSIONS.SUBMISSIONS_REVIEW)
      ? await loadCaseReportIndex()
      : (await loadCasesForUser(auth.user)).map(toCaseSummary);
    const page = paginateApiItems(cases, url, caseSearchText, {
      status: (item) => item.status,
      paymentStatus: (item) => doctorPaymentStatus(item)
    });
    return sendJson(res, 200, { cases: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/cases') {
    const body = await readJsonBody(req);
    assertTemplateRequiredFields(await readSettings(), 'hr', auth.user.role, body.customFields || {});
    const medicalCase = await sanitizeMedicalCase(body, auth.user);
    await saveMedicalCase(medicalCase);
    let assignmentNotification = { status: 'skipped', message: 'No doctor assignment notification needed.' };
    if (medicalCase.status === CASE_STATUSES.SENT_TO_DOCTOR && medicalCase.assignedClinicianId) {
      assignmentNotification = await notifyDoctorAssignment(medicalCase);
    } else if (medicalCase.status === CASE_STATUSES.SENT_TO_PATIENT) {
      assignmentNotification = await notifyPatientCaseAssigned(medicalCase);
    }
    await appendAudit('medical_case_created', {
      caseId: medicalCase.id,
      patientId: medicalCase.patientId,
      route: medicalCase.route,
      status: medicalCase.status,
      userId: auth.user.id
    });
    return sendJson(res, 201, { case: toCaseSummary(medicalCase), notification: assignmentNotification });
  }

  const caseMatch = pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)$/);
  if (caseMatch && req.method === 'GET') {
    const medicalCase = await loadMedicalCaseById(caseMatch[1]);
    await assertCanViewMedicalCase(auth.user, medicalCase);
    return sendJson(res, 200, { case: toCaseSummary(medicalCase) });
  }

  if (caseMatch && req.method === 'PATCH') {
    const medicalCase = await loadMedicalCaseById(caseMatch[1]);
    await assertCanUpdateMedicalCase(auth.user, medicalCase);
    const body = await readJsonBody(req);
    if (auth.user.role === ROLES.PATIENT && body.intent === 'submit') {
      assertTemplateRequiredFields(await readSettings(), 'patient', auth.user.role, body.patientCaseData?.customFields || {});
    }
    const previousClinicianId = medicalCase.assignedClinicianId;
    const previousStatus = medicalCase.status;
    const previousPaymentStatus = medicalCase.paymentStatus;
    const previousPayableAmount = medicalCase.payableAmount;
    updateMedicalCase(medicalCase, body, auth.user);
    await saveMedicalCase(medicalCase);
    let assignmentNotification = { status: 'skipped', message: 'No new doctor assignment notification needed.' };
    if (medicalCase.assignedClinicianId && medicalCase.assignedClinicianId !== previousClinicianId && medicalCase.status === CASE_STATUSES.SENT_TO_DOCTOR) {
      assignmentNotification = await notifyDoctorAssignment(medicalCase);
    }
    await appendAudit('medical_case_updated', {
      caseId: medicalCase.id,
      patientId: medicalCase.patientId,
      status: medicalCase.status,
      userId: auth.user.id
    });
    if (previousStatus !== medicalCase.status) {
      await appendAudit('medical_case_status_changed', {
        caseId: medicalCase.id,
        userId: auth.user.id,
        from: previousStatus,
        to: medicalCase.status
      });
    }
    if (previousPaymentStatus !== medicalCase.paymentStatus || previousPayableAmount !== medicalCase.payableAmount) {
      await appendAudit('medical_case_billing_changed', {
        caseId: medicalCase.id,
        userId: auth.user.id,
        fromStatus: previousPaymentStatus,
        toStatus: medicalCase.paymentStatus,
        fromAmount: previousPayableAmount,
        toAmount: medicalCase.payableAmount
      });
    }
    return sendJson(res, 200, { case: toCaseSummary(medicalCase), notification: assignmentNotification });
  }

  const caseDraftMatch = pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)\/draft$/);
  if (caseDraftMatch && req.method === 'PUT') {
    const medicalCase = await loadMedicalCaseById(caseDraftMatch[1]);
    await assertCanDoctorProcessCase(auth.user, medicalCase);
    const body = await readJsonBody(req);
    medicalCase.doctorDraft = sanitizeDoctorDraft(body.draft || body);
    medicalCase.updatedAt = new Date().toISOString();
    if (medicalCase.status === CASE_STATUSES.SENT_TO_DOCTOR) medicalCase.status = CASE_STATUSES.REVIEW_PENDING;
    await saveMedicalCase(medicalCase);
    await appendAudit('medical_case_draft_saved', { caseId: medicalCase.id, userId: auth.user.id });
    return sendJson(res, 200, { case: toCaseSummary(medicalCase) });
  }

  const caseCancelMatch = pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)\/cancel$/);
  if (caseCancelMatch && req.method === 'POST') {
    const medicalCase = await loadMedicalCaseById(caseCancelMatch[1]);
    await assertCanDoctorProcessCase(auth.user, medicalCase);
    const body = await readJsonBody(req);
    const reason = requiredText(body.reason, 'Cancellation reason', 1000);
    medicalCase.status = CASE_STATUSES.CANCELED_BY_DOCTOR;
    medicalCase.canceledAt = new Date().toISOString();
    medicalCase.canceledBy = auth.user.id;
    medicalCase.canceledByName = auth.user.displayName;
    medicalCase.cancellationReason = reason;
    medicalCase.updatedAt = medicalCase.canceledAt;
    await saveMedicalCase(medicalCase);
    await appendAudit('medical_case_canceled_by_doctor', { caseId: medicalCase.id, userId: auth.user.id });
    return sendJson(res, 200, { case: toCaseSummary(medicalCase) });
  }

  const caseAttachmentMatch = pathname.match(/^\/api\/cases\/([a-zA-Z0-9_-]+)\/attachments$/);
  if (caseAttachmentMatch && req.method === 'POST') {
    const medicalCase = await loadMedicalCaseById(caseAttachmentMatch[1]);
    await assertCanDoctorProcessCase(auth.user, medicalCase);
    const body = await readJsonBody(req);
    const attachment = await saveCaseAttachment(medicalCase, body, auth.user);
    medicalCase.attachments = [...(Array.isArray(medicalCase.attachments) ? medicalCase.attachments : []), attachment];
    medicalCase.updatedAt = new Date().toISOString();
    await saveMedicalCase(medicalCase);
    await appendAudit('medical_case_attachment_uploaded', { caseId: medicalCase.id, attachmentId: attachment.id, userId: auth.user.id });
    return sendJson(res, 201, { attachment, case: toCaseSummary(medicalCase) });
  }

  if (req.method === 'POST' && pathname === '/api/candidates') {
    const candidate = sanitizeCandidate(await readJsonBody(req), auth.user);
    await saveCandidate(candidate);
    const assignmentNotification = await notifyDoctorAssignment(candidate);
    await appendAudit('candidate_created', {
      candidateId: candidate.id,
      userId: auth.user.id,
      assignedClinicianId: candidate.assignedClinicianId
    });
    return sendJson(res, 201, { candidate: toCandidateSummary(candidate), notification: assignmentNotification });
  }

  const candidateUserMatch = pathname.match(/^\/api\/candidates\/([a-zA-Z0-9_-]+)\/user$/);
  if (candidateUserMatch && req.method === 'POST') {
    const candidate = await loadCandidateById(candidateUserMatch[1]);
    const body = await readJsonBody(req);
    const email = requiredEmail(candidate.email, 'Patient email');
    const displayName = requiredText(candidate.fullName, 'Patient name', 140);
    const users = await readUsers();
    let user = users.find((item) => normalizeEmail(item.email) === normalizeEmail(email));
    const createdUser = !user;
    const shouldResetPassword = Boolean(body.resetPassword || !user);
    const temporaryPassword = shouldResetPassword
      ? requiredPassword(body.password || randomReadablePassword())
      : '';

    if (user && user.role !== ROLES.PATIENT) {
      throw new HttpError(409, 'That email already belongs to a non-patient user.');
    }

    if (user) {
      user.displayName = displayName;
      user.active = true;
      if (shouldResetPassword) {
        user.password = makePasswordRecord(temporaryPassword);
        user.mustChangePassword = true;
      }
    } else {
      user = createUser({
        email,
        displayName,
        role: ROLES.PATIENT,
        password: temporaryPassword
      });
      users.push(user);
    }

    candidate.linkedUserId = user.id;
    candidate.linkedUserEmail = user.email;
    candidate.loginAccessRevokedAt = '';
    candidate.loginAccessRevokedUserId = '';
    candidate.updatedAt = new Date().toISOString();
    await mutateUsers((currentUsers) => {
      const currentUser = currentUsers.find((item) => item.id === user.id);
      if (currentUser) Object.assign(currentUser, user);
      else {
        assertUniqueUserEmail(currentUsers, user.email);
        currentUsers.push(user);
      }
    });
    await saveCandidate(candidate);
    const notification = shouldResetPassword ? await sendAccountCreatedEmail(user, temporaryPassword) : { status: 'skipped', message: 'Password was not changed.' };
    await appendAudit('patient_user_linked', {
      userId: auth.user.id,
      patientId: candidate.id,
      targetUserId: user.id,
      passwordReset: shouldResetPassword
    });
    return sendJson(res, createdUser ? 201 : 200, {
      user: publicAdminUser(user),
      candidate: toCandidateSummary(candidate),
      temporaryPassword: shouldResetPassword ? temporaryPassword : '',
      notification
    });
  }

  const candidateMatch = pathname.match(/^\/api\/candidates\/([a-zA-Z0-9_-]+)$/);
  if (candidateMatch && req.method === 'PATCH') {
    const candidate = await loadCandidateById(candidateMatch[1]);
    const body = await readJsonBody(req);
    const previousClinicianId = candidate.assignedClinicianId;

    if (hasPermission(auth.user, PERMISSIONS.REPORTS_VIEW)) {
      updateCandidateFromReviewer(candidate, body);
    } else if (auth.user.role === ROLES.DOCTOR && candidate.assignedClinicianId === auth.user.id) {
      updateCandidateFromClinician(candidate, body);
    } else if (auth.user.role === ROLES.PATIENT && candidate.email?.toLowerCase() === auth.user.email) {
      updateCandidateFromPatient(candidate, body);
    } else {
      throw new HttpError(403, 'You are not authorized to update this candidate.');
    }

    await saveCandidate(candidate);
    if (auth.user.role === ROLES.PATIENT && candidate.email && candidate.email !== auth.user.email) {
      await updateUserEmail(auth.user.id, candidate.email);
      auth.user.email = candidate.email;
    }
    let assignmentNotification = { status: 'skipped', message: 'No new doctor assignment notification needed.' };
    if (candidate.assignedClinicianId && candidate.assignedClinicianId !== previousClinicianId) {
      assignmentNotification = await notifyDoctorAssignment(candidate);
    }
    await appendAudit('candidate_updated', {
      candidateId: candidate.id,
      userId: auth.user.id,
      status: candidate.status,
      assignedClinicianId: candidate.assignedClinicianId
    });
    return sendJson(res, 200, { candidate: toCandidateSummary(candidate), notification: assignmentNotification });
  }

  if (req.method === 'GET' && pathname === '/api/setup/clinicians') {
    const users = await readUsers();
    const clinicians = users
      .filter((user) => user.role === ROLES.DOCTOR && user.active !== false)
      .map(publicAdminUser)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    const page = paginateApiItems(clinicians, url, userSearchText);
    return sendJson(res, 200, { clinicians: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/setup/clinicians') {
    const body = await readJsonBody(req);
    const user = createUser({
      email: requiredEmail(body.email, 'Email'),
      displayName: requiredText(body.displayName, 'Display name', 140),
      role: ROLES.DOCTOR,
      password: requiredPassword(body.password),
      medicalProfile: sanitizeMedicalProfile(body.medicalProfile || body)
    });
    const users = await readUsers();
    if (users.some((candidate) => candidate.email === user.email)) {
      throw new HttpError(409, 'A user with that email already exists.');
    }
    users.push(user);
    await writeUsers(users);
    await appendAudit('clinician_created_by_reviewer', { userId: auth.user.id, clinicianId: user.id });
    return sendJson(res, 201, { clinician: publicAdminUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/setup/reviewers') {
    const users = await readUsers();
    const reviewers = users
      .filter((user) => [ROLES.REVIEWER, ROLES.ADMIN].includes(user.role) && user.active !== false)
      .map(publicAdminUser)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    const page = paginateApiItems(reviewers, url, userSearchText);
    return sendJson(res, 200, { reviewers: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/setup/reviewers') {
    const body = await readJsonBody(req);
    const user = createUser({
      email: requiredEmail(body.email, 'Email'),
      displayName: requiredText(body.displayName, 'Display name', 140),
      role: ROLES.REVIEWER,
      password: requiredPassword(body.password)
    });
    const users = await readUsers();
    if (users.some((candidate) => candidate.email === user.email)) {
      throw new HttpError(409, 'A user with that email already exists.');
    }
    users.push(user);
    await writeUsers(users);
    await appendAudit('reviewer_created_by_reviewer', { userId: auth.user.id, reviewerId: user.id });
    return sendJson(res, 201, { reviewer: publicAdminUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/medical-offices') {
    const offices = await readMedicalOffices();
    const page = paginateApiItems(offices, url, officeSearchText);
    return sendJson(res, 200, { offices: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/medical-offices') {
    const body = await readJsonBody(req);
    const office = sanitizeMedicalOffice(body);
    const offices = await readMedicalOffices();
    offices.push(office);
    await writeMedicalOffices(offices);
    await appendAudit('medical_office_created', { userId: auth.user.id, officeId: office.id });
    return sendJson(res, 201, { office });
  }

  const medicalOfficeMatch = pathname.match(/^\/api\/medical-offices\/([a-zA-Z0-9_-]+)$/);
  if (medicalOfficeMatch && req.method === 'PATCH') {
    const offices = await readMedicalOffices();
    const office = offices.find((item) => item.id === medicalOfficeMatch[1]);
    if (!office) throw new HttpError(404, 'Medical office not found.');
    Object.assign(office, sanitizeMedicalOffice({ ...office, ...(await readJsonBody(req)), id: office.id, createdAt: office.createdAt }));
    office.updatedAt = new Date().toISOString();
    await writeMedicalOffices(offices);
    await appendAudit('medical_office_updated', { userId: auth.user.id, officeId: office.id });
    return sendJson(res, 200, { office });
  }

  if (req.method === 'GET' && pathname === '/api/notification-settings') {
    const settings = await readSettings();
    return sendJson(res, 200, {
      settings: {
        notificationEmail: settings.notificationEmail,
        doctorNotificationEmail: settings.doctorNotificationEmail
      }
    });
  }

  if (req.method === 'PUT' && pathname === '/api/notification-settings') {
    const body = await readJsonBody(req);
    const current = await readSettings();
    const settings = sanitizeSettings({
      ...current,
      notificationEmail: body.notificationEmail,
      doctorNotificationEmail: body.doctorNotificationEmail
    });
    await writeSettings(settings);
    await appendAudit('notification_settings_updated', { userId: auth.user.id });
    return sendJson(res, 200, {
      settings: {
        notificationEmail: settings.notificationEmail,
        doctorNotificationEmail: settings.doctorNotificationEmail
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/reports/monthly-doctors') {
    const [cases, submissions, users, offices] = await Promise.all([
      loadAllMedicalCases(),
      loadAllSubmissions(),
      readUsers(),
      readMedicalOffices()
    ]);
    return sendJson(res, 200, {
      report: buildMonthlyDoctorReport(cases, submissions, users, offices)
    });
  }

  if (req.method === 'GET' && pathname === '/api/reports/doctor-cases') {
    if (auth.user.role !== ROLES.DOCTOR) {
      throw new HttpError(403, 'Doctor case reports are available only to medical office users.');
    }
    const [submissions, cases] = await Promise.all([
      loadSubmissionsForUser(auth.user),
      loadAllMedicalCases()
    ]);
    const casesById = new Map(cases.map((medicalCase) => [medicalCase.id, medicalCase]));
    const rows = submissions
      .map((submission) => doctorCaseReportRow(submission, casesById.get(submission.caseId)))
      .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
    const page = paginateApiItems(rows, url, doctorCaseReportSearchText, {
      status: (item) => item.status,
      paymentStatus: (item) => item.paymentStatus
    });
    return sendJson(res, 200, {
      cases: page.items,
      pagination: page.pagination,
      summary: doctorCaseReportSummary(rows)
    });
  }

  if (req.method === 'GET' && pathname === '/api/reports/management') {
    const [cases, users, offices, patientStats] = await Promise.all([
      loadCaseReportIndex(),
      readUsers(),
      readMedicalOffices(),
      buildPatientReportStats()
    ]);
    const assignedClinicianIds = new Set(cases.map((medicalCase) => medicalCase.assignedClinicianId).filter(Boolean));
    const clinicians = users
      .filter((user) => user.role === ROLES.DOCTOR && user.active !== false && assignedClinicianIds.has(user.id))
      .map(publicAdminUser)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    const activeMedicalUsers = users.filter((user) => user.role === ROLES.DOCTOR && user.active !== false);
    const activeOffices = offices.filter((office) => office.active !== false);
    const reportOffices = activeOffices.filter((office) => (office.assignedClinicianIds || []).some((id) => assignedClinicianIds.has(id)));
    return sendJson(res, 200, {
      cases,
      clinicians,
      offices: reportOffices,
      patientStats,
      userStats: {
        doctors: activeMedicalUsers.filter(isDoctorOfficeUser).length,
        clinicians: activeMedicalUsers.filter((user) => !isDoctorOfficeUser(user)).length,
        offices: activeOffices.length
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/admin/settings') {
    return sendJson(res, 200, { settings: adminSettings(await readSettings()) });
  }

  if (req.method === 'GET' && pathname === '/api/admin/audit') {
    return sendJson(res, 200, { entries: await readAuditEntries() });
  }

  if (req.method === 'GET' && pathname === '/api/admin/database-status') {
    const savedSettings = await readSettings();
    return sendJson(res, 200, {
      enabled: database.enabled,
      provider: configuredDatabase.provider,
      dialect: database.dialect || configuredDatabase.dialect,
      autoMigrate: configuredDatabase.autoMigrate,
      source: cleanText(env.DATABASE_CONFIG_SOURCE, 20) || savedSettings.database?.source || 'environment',
      schemaReady: database.enabled,
      storageMode: 'encrypted-file'
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/database-test') {
    const current = await readSettings();
    const body = await readJsonBody(req);
    const databaseSettings = databaseSettingsFromRequest(body.database, current.database);
    const testConfig = effectiveDatabaseConfig(databaseSettings);
    if (!testConfig.enabled) throw new HttpError(400, 'Enable the database before testing the connection.');
    const testDatabase = await initializeDatabase({ ...testConfig, autoCreate: false, autoMigrate: false });
    await testDatabase.close();
    await appendAudit('database_connection_tested', {
      userId: auth.user.id,
      provider: testConfig.provider,
      dialect: testConfig.dialect,
      source: databaseSettings.source
    });
    return sendJson(res, 200, { message: `Connected successfully to ${testConfig.dialect}.` });
  }

  if (req.method === 'PUT' && pathname === '/api/admin/database-config') {
    const current = await readSettings();
    const body = await readJsonBody(req);
    const databaseSettings = databaseSettingsFromRequest(body.database, current.database);
    const nextConfig = effectiveDatabaseConfig(databaseSettings);
    let nextDatabase = { enabled: false, dialect: '', close: async () => {} };
    if (nextConfig.enabled) nextDatabase = await initializeDatabase(nextConfig);

    const nextSettings = sanitizeSettings({ ...current, database: databaseSettings });
    try {
      await writeSettings(nextSettings);
    } catch (error) {
      await nextDatabase.close().catch(() => {});
      throw error;
    }

    const previousDatabase = database;
    database = nextDatabase;
    configuredDatabase = nextConfig;
    await previousDatabase.close().catch((error) => console.error('Previous database pool shutdown error:', error.message));
    await appendAudit('database_configuration_updated', {
      userId: auth.user.id,
      enabled: nextConfig.enabled,
      provider: nextConfig.provider,
      dialect: nextConfig.dialect,
      source: databaseSettings.source
    });
    return sendJson(res, 200, {
      message: nextConfig.enabled
        ? 'Database schema connected and migrations are current. Application records remain in encrypted file storage until repository cutover.'
        : 'Database connection disabled.',
      settings: adminSettings(nextSettings),
      status: {
        enabled: database.enabled,
        provider: nextConfig.provider,
        dialect: database.dialect || nextConfig.dialect,
        source: databaseSettings.source,
        schemaReady: database.enabled,
        storageMode: 'encrypted-file'
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/admin/form-template') {
    const settings = await readSettings();
    return sendJson(res, 200, { formTemplate: settings.formTemplate });
  }

  if (req.method === 'PUT' && pathname === '/api/admin/form-template') {
    const body = await readJsonBody(req);
    const current = await readSettings();
    const settings = sanitizeSettings({ ...current, formTemplate: body.formTemplate });
    await writeSettings(settings);
    await appendAudit('form_template_updated', { userId: auth.user.id });
    return sendJson(res, 200, { formTemplate: settings.formTemplate });
  }

  if (req.method === 'PUT' && pathname === '/api/admin/settings') {
    const current = await readSettings();
    const body = await readJsonBody(req);
    if (body?.mail?.password === '********') body.mail.password = current.mail?.password || '';
    if (body?.database?.password === '********') body.database.password = current.database?.password || '';
    if (body?.database?.sslKey === '********') body.database.sslKey = current.database?.sslKey || '';
    const settings = sanitizeSettings({ ...current, ...body });
    await writeSettings(settings);
    await appendAudit('settings_updated', { userId: auth.user.id });
    return sendJson(res, 200, { settings: adminSettings(settings) });
  }

  if (req.method === 'POST' && pathname === '/api/admin/mail-test') {
    const current = await readSettings();
    const body = await readJsonBody(req);
    const testSettingsSource = body.settings && typeof body.settings === 'object' ? body.settings : current;
    if (testSettingsSource?.mail?.password === '********') testSettingsSource.mail.password = current.mail?.password || '';
    const testSettings = sanitizeSettings({ ...current, ...testSettingsSource });
    if (testSettings.mail?.host) testSettings.mail.enabled = true;
    const smtpSettings = effectiveSmtpSettings(testSettings);
    const recipient = requiredEmail(body.recipient, 'Test recipient');
    if (!smtpSettings.smtp.host) {
      throw new HttpError(400, 'SMTP host is required before sending a test email.');
    }
    await sendSmtpMail({
      ...smtpSettings.smtp,
      from: smtpSettings.fromEmail,
      to: [recipient],
      subject: `${testSettings.appName || config.appName}: mail server test`,
      text: [
        'This is a test email from the medical platform mail settings.',
        '',
        `Sent at: ${formatDateTime(new Date().toISOString())}`,
        `Requested by: ${auth.user.email}`
      ].join('\n')
    });
    await appendAudit('mail_test_sent', { userId: auth.user.id, recipientHash: hashForAudit(recipient) });
    return sendJson(res, 200, { message: `Test email sent to ${recipient}.` });
  }

  if (req.method === 'GET' && pathname === '/api/user-management/users') {
    const users = await readUsers();
    const visibleUsers = auth.user.role === ROLES.ADMIN
      ? users
      : users.filter((user) => user.role !== ROLES.ADMIN);
    const page = paginateApiItems(visibleUsers.map(publicAdminUser), url, userSearchText);
    return sendJson(res, 200, { users: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/user-management/users') {
    const body = await readJsonBody(req);
    const role = allowedManagedRole(body.role, auth.user);
    const displayName = requiredText(body.displayName, 'Display name', 140);
    const user = createUser({
      email: requiredEmail(body.email, 'Email'),
      displayName,
      role,
      password: requiredPassword(body.password),
      medicalProfile: sanitizeManagedUserMedicalProfile(body, role, displayName)
    });
    let linkedPatient = null;
    if (role === ROLES.PATIENT) {
      linkedPatient = await buildOrLinkPatientProfileForUser(user, body.patientProfile || {}, auth.user);
    }
    await mutateUsers((users) => {
      assertUniqueUserEmail(users, user.email);
      users.push(user);
    });
    if (linkedPatient) await saveCandidate(linkedPatient);
    const notification = await sendAccountCreatedEmail(user, body.password);
    await appendAudit('managed_user_created', { userId: auth.user.id, targetUserId: user.id, targetRole: user.role });
    return sendJson(res, 201, {
      user: publicAdminUser(user),
      patient: linkedPatient ? toCandidateSummary(linkedPatient) : null,
      notification
    });
  }

  const managedUserResetMatch = pathname.match(/^\/api\/user-management\/users\/([a-zA-Z0-9_-]+)\/password-reset$/);
  if (managedUserResetMatch && req.method === 'POST') {
    const users = await readUsers();
    const user = users.find((candidate) => candidate.id === managedUserResetMatch[1] && candidate.active !== false);
    if (!user) throw new HttpError(404, 'Active user not found.');
    if (auth.user.role !== ROLES.ADMIN && user.role === ROLES.ADMIN) {
      throw new HttpError(403, 'Only administrators can reset administrator passwords.');
    }
    const delivery = await issuePasswordReset(user, { requestedByUserId: auth.user.id });
    return sendJson(res, 200, { message: delivery.message, notification: delivery });
  }

  const managedUserMatch = pathname.match(/^\/api\/user-management\/users\/([a-zA-Z0-9_-]+)$/);
  if (managedUserMatch && req.method === 'DELETE') {
    if (auth.user.role !== ROLES.ADMIN) throw new HttpError(403, 'Only administrators can delete users.');
    const result = await deleteManagedUser(managedUserMatch[1], auth.user);
    return sendJson(res, 200, result);
  }

  if (managedUserMatch && req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const users = await readUsers();
    const user = users.find((candidate) => candidate.id === managedUserMatch[1]);
    if (!user) throw new HttpError(404, 'User not found.');
    if (auth.user.role !== ROLES.ADMIN && user.role === ROLES.ADMIN) throw new HttpError(403, 'Only administrators can manage administrator accounts.');

    if (body.email !== undefined) user.email = requiredEmail(body.email, 'Email');
    if (body.displayName !== undefined) user.displayName = requiredText(body.displayName, 'Display name', 140);
    if (body.role !== undefined) user.role = allowedManagedRole(body.role, auth.user);
    if (body.medicalProfile !== undefined) user.medicalProfile = sanitizeMedicalProfile(body.medicalProfile);
    if (body.active !== undefined) {
      if (user.id === auth.user.id && body.active === false) throw new HttpError(400, 'You cannot deactivate your own account.');
      user.active = cleanBool(body.active);
    }
    if (body.password !== undefined && body.password !== '') {
      user.password = makePasswordRecord(requiredPassword(body.password));
      user.mustChangePassword = true;
    }

    assertUniqueUserEmail(users, user.email, user.id);

    await writeUsers(users);
    await appendAudit('managed_user_updated', { userId: auth.user.id, targetUserId: user.id, targetRole: user.role });
    return sendJson(res, 200, { user: publicAdminUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const users = await readUsers();
    const page = paginateApiItems(users.map(publicAdminUser), url, userSearchText);
    return sendJson(res, 200, { users: page.items, pagination: page.pagination });
  }

  if (req.method === 'POST' && pathname === '/api/admin/users') {
    const body = await readJsonBody(req);
    const user = createUser({
      email: requiredEmail(body.email, 'Email'),
      displayName: requiredText(body.displayName, 'Display name', 140),
      role: cleanRole(body.role),
      password: requiredPassword(body.password),
      medicalProfile: sanitizeMedicalProfile(body.medicalProfile || body)
    });
    await mutateUsers((users) => {
      assertUniqueUserEmail(users, user.email);
      users.push(user);
    });
    await appendAudit('user_created', { userId: auth.user.id, targetUserId: user.id, targetRole: user.role });
    return sendJson(res, 201, { user: publicAdminUser(user) });
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
  if (adminUserMatch && req.method === 'DELETE') {
    const result = await deleteManagedUser(adminUserMatch[1], auth.user);
    return sendJson(res, 200, result);
  }

  if (adminUserMatch && req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const users = await readUsers();
    const user = users.find((candidate) => candidate.id === adminUserMatch[1]);
    if (!user) throw new HttpError(404, 'User not found.');

    if (body.email !== undefined) user.email = requiredEmail(body.email, 'Email');
    if (body.displayName !== undefined) user.displayName = requiredText(body.displayName, 'Display name', 140);
    if (body.role !== undefined) user.role = cleanRole(body.role);
    if (body.medicalProfile !== undefined) user.medicalProfile = sanitizeMedicalProfile(body.medicalProfile);
    if (body.active !== undefined) {
      if (user.id === auth.user.id && body.active === false) throw new HttpError(400, 'You cannot deactivate your own account.');
      user.active = cleanBool(body.active);
    }
    if (body.password !== undefined && body.password !== '') user.password = makePasswordRecord(requiredPassword(body.password));

    const duplicate = users.find((candidate) => candidate.id !== user.id && candidate.email === user.email);
    if (duplicate) throw new HttpError(409, 'A user with that email already exists.');

    await writeUsers(users);
    await appendAudit('user_updated', { userId: auth.user.id, targetUserId: user.id, targetRole: user.role });
    return sendJson(res, 200, { user: publicAdminUser(user) });
  }

  const submissionMatch = pathname.match(/^\/api\/submissions\/([a-zA-Z0-9_-]+)$/);
  if (submissionMatch && req.method === 'GET') {
    const submission = await loadSubmissionById(submissionMatch[1]);
    assertCanViewSubmission(auth.user, submission);
    return sendJson(res, 200, { submission });
  }

  if (submissionMatch && req.method === 'PATCH') {
    const existing = await loadSubmissionById(submissionMatch[1]);
    assertCanEditFollowUp(auth.user, existing);
    const updated = sanitizeSubmission(await readJsonBody(req), auth.user);
    const submission = {
      ...updated,
      id: existing.id,
      caseId: existing.caseId || existing.candidate?.caseId || existing.candidate?.candidateId || '',
      patientId: existing.patientId || existing.candidate?.patientId || '',
      version: Number(existing.version || 1) + 1,
      originalSubmittedAt: existing.originalSubmittedAt || existing.submittedAt,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patientCaseData: existing.patientCaseData || {},
      familyHistory: existing.familyHistory || existing.patientCaseData?.familyHistory || {},
      consent: existing.consent || existing.patientCaseData?.consent || {},
      updateHistory: [
        ...(Array.isArray(existing.updateHistory) ? existing.updateHistory : []),
        {
          updatedAt: new Date().toISOString(),
          updatedBy: auth.user.id,
          previousReviewStatus: existing.review?.status || 'pending',
          previousReviewNotes: existing.review?.notes || ''
        }
      ],
      review: {
        status: 'pending',
        notes: '',
        reviewedAt: '',
        reviewedBy: '',
        reviewedByName: ''
      }
    };
    await saveSubmission(submission);
    await appendAudit('submission_follow_up_updated', { submissionId: submission.id, userId: auth.user.id });
    const notification = await notifyReviewers(submission);
    return sendJson(res, 200, { submission, notification });
  }

  const reviewMatch = pathname.match(/^\/api\/submissions\/([a-zA-Z0-9_-]+)\/review$/);
  if (reviewMatch && req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const submission = await loadSubmissionById(reviewMatch[1]);
    submission.review = {
      status: oneOf(body.status, ['pending', 'reviewed', 'needs_follow_up', 'archived'], 'Review status'),
      notes: cleanText(body.notes, 1500),
      reviewedAt: new Date().toISOString(),
      reviewedBy: auth.user.id,
      reviewedByName: auth.user.displayName
    };

    await saveSubmission(submission);
    await appendAudit('submission_review_updated', {
      submissionId: submission.id,
      userId: auth.user.id,
      reviewStatus: submission.review.status
    });

    let notification = { status: 'skipped', message: 'No doctor notification was required for this review status.' };
    if (submission.review.status === 'needs_follow_up') {
      notification = await notifyDoctorFollowUpRequested(submission);
    } else if (submission.review.status === 'archived') {
      notification = await notifyDoctorArchived(submission);
    }

    return sendJson(res, 200, { submission, notification });
  }

  throw new HttpError(404, 'API route not found.');
}

async function handlePrint(req, res, submissionId) {
  const auth = await requireAuth(req, res);
  requirePermission(auth.user, PERMISSIONS.SUBMISSIONS_DOWNLOAD);
  const submission = await loadSubmissionById(submissionId);
  const settings = await readSettings();
  assertCanViewSubmission(auth.user, submission);

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
  );
  sendHtml(res, 200, renderPrintableSubmission(submission, settings));
}

async function handleDownload(req, res, submissionId) {
  const auth = await requireAuth(req, res);
  requirePermission(auth.user, PERMISSIONS.SUBMISSIONS_DOWNLOAD);
  const submission = await loadSubmissionById(submissionId);
  const settings = await readSettings();
  assertCanViewSubmission(auth.user, submission);

  const fileName = `${safeFileName(submission.candidate.fullName || submission.id)}-${submission.id}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
  res.end(await renderSubmissionPdf(submission, settings));
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = cleanText(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const attemptKey = `${getClientIp(req)}:${email || 'unknown'}`;

  if (isRateLimited(attemptKey)) {
    throw new HttpError(429, 'Too many login attempts. Try again later.');
  }

  const users = await readUsers();
  const user = users.find((candidate) => candidate.email === email && candidate.active !== false);
  if (!user || !verifyPassword(password, user.password)) {
    recordFailedLogin(attemptKey);
    await appendAudit('login_failed', { emailHash: hashForAudit(email), ipHash: hashForAudit(getClientIp(req)) });
    throw new HttpError(401, 'Invalid email or password.');
  }

  loginAttempts.delete(attemptKey);

  const sessionId = randomToken(32);
  const session = {
    userId: user.id,
    csrfToken: randomToken(32),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + config.sessionTtlMs
  };
  sessions.set(sessionId, session);

  res.setHeader('Set-Cookie', makeSessionCookie(sessionId));
  await appendAudit('login_success', { userId: user.id, role: user.role });
  sendJson(res, 200, {
    user: publicUser(user),
    csrfToken: session.csrfToken,
    session: publicSession(session)
  });
}

async function handlePasswordResetRequest(req, res) {
  const body = await readJsonBody(req);
  const email = cleanText(body.email, 254).toLowerCase();
  const users = await readUsers();
  const user = users.find((candidate) => normalizeEmail(candidate.email) === normalizeEmail(email) && candidate.active !== false);
  if (user) await issuePasswordReset(user, { ipHash: hashForAudit(getClientIp(req)) });
  await appendAudit('password_reset_requested', { emailHash: hashForAudit(email), ipHash: hashForAudit(getClientIp(req)) });
  return sendJson(res, 200, {
    ok: true,
    message: 'If the email matches an active account, a password reset link has been sent.'
  });
}

async function handlePasswordResetConfirm(req, res) {
  const body = await readJsonBody(req);
  const token = cleanText(body.token, 200);
  const tokenHash = hashForAudit(token);
  const record = passwordResetTokens.get(tokenHash);
  if (!record || record.usedAt || record.expiresAt <= Date.now()) {
    passwordResetTokens.delete(tokenHash);
    throw new HttpError(400, 'This password reset link is invalid or has expired.');
  }

  await mutateUsers((users) => {
    const user = users.find((candidate) => candidate.id === record.userId && candidate.active !== false);
    if (!user) throw new HttpError(404, 'Active user not found.');
    user.password = makePasswordRecord(requiredPassword(body.newPassword));
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date().toISOString();
  });
  record.usedAt = Date.now();
  passwordResetTokens.delete(tokenHash);
  await revokeOtherUserSessions(record.userId);
  await appendAudit('password_reset_completed', { userId: record.userId });
  return sendJson(res, 200, { message: 'Your password has been reset. You can now sign in.' });
}

function sanitizeSubmission(payload, user) {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, 'A submission body is required.');
  }

  const now = new Date().toISOString();
  const id = `med_${Date.now().toString(36)}_${randomToken(8)}`;
  const candidate = payload.candidate || {};
  const assessment = payload.assessment || {};
  const vitals = payload.vitals || {};
  const history = payload.medicalHistory || {};
  const family = payload.familyHistory || {};
  const consent = payload.consent || {};
  const exam = payload.physicalExam || {};
  const labs = payload.labResults || {};
  const determination = payload.determination || {};
  const attestation = payload.attestation || {};

  const sanitized = {
    id,
    version: 1,
    status: 'submitted',
    submittedAt: now,
    submittedBy: user.id,
    submittedByName: user.displayName,
    submittedByEmail: user.email,
    caseId: cleanText(candidate.caseId || candidate.candidateId, 80),
    patientId: cleanText(candidate.patientId, 80),
    candidate: {
      candidateId: cleanText(candidate.candidateId || candidate.caseId, 80),
      caseId: cleanText(candidate.caseId || candidate.candidateId, 80),
      patientId: cleanText(candidate.patientId, 80),
      fullName: requiredText(candidate.fullName, 'Candidate full name', 140),
      employeeId: cleanText(candidate.employeeId, 80),
      nationalId: cleanText(candidate.nationalId, 80),
      dateOfBirth: requiredDate(candidate.dateOfBirth, 'Date of birth'),
      email: cleanText(candidate.email, 254),
      contactNumber: cleanText(candidate.contactNumber, 50),
      position: requiredText(candidate.position, 'Position applied for', 140),
      medicationInformation: cleanText(candidate.medicationInformation, 2000)
    },
    assessment: {
      facilityName: requiredText(assessment.facilityName, 'Medical facility', 180),
      facilityAddress: cleanText(assessment.facilityAddress, 260),
      assessmentDate: requiredDate(assessment.assessmentDate, 'Assessment date'),
      clinicianName: requiredText(assessment.clinicianName, 'Clinician name', 140),
      clinicianRegistrationNumber: cleanText(assessment.clinicianRegistrationNumber, 100),
      telephoneNumber: cleanText(assessment.telephoneNumber, 50),
      faxNumber: cleanText(assessment.faxNumber, 50),
      emailAddress: cleanText(assessment.emailAddress, 254)
    },
    vitals: {
      heightCm: cleanText(vitals.heightCm, 30),
      weightKg: cleanText(vitals.weightKg, 30),
      bloodPressure: cleanText(vitals.bloodPressure, 30),
      pulse: cleanText(vitals.pulse, 30),
      vision: cleanText(vitals.vision, 180),
      hearing: cleanText(vitals.hearing, 180),
      urine: cleanText(vitals.urine, 180)
    },
    medicalHistory: {
      cardiac: cleanBool(history.cardiac),
      respiratory: cleanBool(history.respiratory),
      diabetes: cleanBool(history.diabetes),
      hypertension: cleanBool(history.hypertension),
      allergies: cleanBool(history.allergies),
      surgeries: cleanBool(history.surgeries),
      medications: cleanBool(history.medications),
      mentalHealth: cleanBool(history.mentalHealth),
      infectiousDisease: cleanBool(history.infectiousDisease),
      notes: cleanText(history.notes, 2000)
    },
    familyHistory: {
      hypertension: cleanBool(family.hypertension),
      diabetes: cleanBool(family.diabetes),
      heartDisease: cleanBool(family.heartDisease),
      asthma: cleanBool(family.asthma),
      cancer: cleanBool(family.cancer),
      stroke: cleanBool(family.stroke),
      kidneyDisease: cleanBool(family.kidneyDisease),
      mentalHealth: cleanBool(family.mentalHealth),
      notes: cleanText(family.notes, 2000)
    },
    physicalExam: sanitizePhysicianExam(exam),
    labResults: {
      additionalTests: cleanText(labs.additionalTests, 2000),
      bloodTest: cleanText(labs.bloodTest, 600),
      urineTest: cleanText(labs.urineTest, 600),
      chestXray: cleanText(labs.chestXray, 600),
      drugScreen: cleanText(labs.drugScreen, 600),
      otherTests: cleanText(labs.otherTests, 1200)
    },
    determination: {
      status: oneOf(determination.status, ['fit', 'fit_with_restrictions', 'temporarily_deferred', 'not_fit'], 'Fitness determination'),
      conclusions: cleanText(determination.conclusions, 2000),
      restrictions: cleanText(determination.restrictions, 1400),
      recommendation: cleanText(determination.recommendation, 1400),
      followUpDate: cleanOptionalDate(determination.followUpDate, 'Follow-up date')
    },
    customFields: cleanCustomFields(payload.customFields),
    attestation: {
      signedBy: requiredText(attestation.signedBy, 'Clinician attestation name', 140),
      signatureDate: requiredDate(attestation.signatureDate, 'Signature date'),
      consentConfirmed: cleanBool(attestation.consentConfirmed),
      signatureDataUrl: cleanSignatureDataUrl(attestation.signatureDataUrl)
    },
    consent: {
      accepted: cleanBool(consent.accepted),
      signedBy: cleanText(consent.signedBy, 140),
      signedAt: cleanText(consent.signedAt, 40),
      signatureDataUrl: cleanSignatureDataUrl(consent.signatureDataUrl)
    },
    review: {
      status: 'pending',
      notes: '',
      reviewedAt: '',
      reviewedBy: '',
      reviewedByName: ''
    }
  };

  if (!sanitized.attestation.consentConfirmed) {
    throw new HttpError(400, 'Consent confirmation is required before submission.');
  }

  return sanitized;
}

function sanitizePhysicianExam(exam = {}) {
  const legacy = {
    generalAppearance: exam.general,
    pulseRate: exam.pulse,
    thorax: exam.respiratory,
    skull: exam.musculoskeletal,
    fundi: exam.nervousSystem,
    disabilities: exam.comments
  };
  return Object.fromEntries(PHYSICIAN_EXAM_FIELD_KEYS.map((key) => [
    key,
    cleanText(exam[key] || legacy[key], key === 'disabilities' ? 2000 : 600)
  ]));
}

async function notifyReviewers(submission) {
  const settings = await readSettings();
  const recipientSource = settings.notificationEmail || config.reviewNotificationEmail;
  const recipients = recipientSource
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  const notification = {
    submissionId: submission.id,
    submittedAt: submission.submittedAt,
    platformUrl: config.publicUrl,
    notice: 'A doctor submitted a medical assessment for reviewer action.'
  };

  const smtpSettings = effectiveSmtpSettings(settings);
  if (recipients.length === 0 || !smtpSettings.smtp.host) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: 'logged',
      recipients,
      notification
    }));
    await appendAudit('notification_logged', { submissionId: submission.id });
    return { status: 'logged', message: 'SMTP is not configured; notification was logged locally.' };
  }

  const message = [
    `Hello National Commercial Bank Jamaica reviewer,`,
    '',
    'A doctor has submitted a medical assessment in the National Commercial Bank Jamaica Medical Platform.',
    '',
    `Submission ID: ${submission.id}`,
    `Candidate profile ID: ${submission.candidate.candidateId || 'Not recorded'}`,
    `Submitted at: ${formatDateTime(submission.submittedAt)}`,
    '',
    'Please sign in to review and file the submission:',
    config.publicUrl,
    '',
    'For confidentiality, no medical details are included in this email.'
  ].join('\n');

  try {
    await sendSmtpMail({
      ...smtpSettings.smtp,
      from: smtpSettings.fromEmail,
      to: recipients,
      subject: `${settings.appName || config.appName}: medical assessment submitted for review`,
      text: message
    });
    await appendAudit('notification_sent', { submissionId: submission.id, recipientCount: recipients.length });
    return { status: 'sent', message: 'Reviewer notification sent.' };
  } catch (error) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: 'failed',
      reason: error.message,
      recipients,
      notification
    }));
    await appendAudit('notification_failed', { submissionId: submission.id, reason: error.message });
    return { status: 'failed', message: 'Submission saved, but email notification failed. Check data/notifications.log.' };
  }
}

async function sendAccountCreatedEmail(user, temporaryPassword) {
  const settings = await readSettings();
  return sendTemplatedAccountEmail({
    user,
    template: settings.emailTemplates.accountCreated,
    values: {
      temporaryPassword,
      loginUrl: config.publicUrl
    },
    logStatus: 'account_created_email',
    auditEvent: 'account_created_email_sent'
  });
}

async function issuePasswordReset(user, context = {}) {
  const token = randomToken(32);
  const tokenHash = hashForAudit(token);
  const expiryMinutes = 30;
  passwordResetTokens.set(tokenHash, {
    userId: user.id,
    expiresAt: Date.now() + expiryMinutes * 60 * 1000,
    createdAt: Date.now()
  });
  const settings = await readSettings();
  const resetUrl = `${config.publicUrl.replace(/\/+$/, '')}/?resetToken=${encodeURIComponent(token)}`;
  const delivery = await sendTemplatedAccountEmail({
    user,
    template: settings.emailTemplates.passwordReset,
    values: { resetUrl, expiryMinutes },
    logStatus: 'password_reset_email',
    auditEvent: 'password_reset_email_sent'
  });
  await appendAudit('password_reset_issued', {
    userId: user.id,
    requestedByUserId: context.requestedByUserId || '',
    ipHash: context.ipHash || '',
    deliveryStatus: delivery.status
  });
  return delivery;
}

async function notifyPatientCaseAssigned(medicalCase) {
  const users = await readUsers();
  const patient = users.find((user) => user.role === ROLES.PATIENT
    && user.active !== false
    && (user.id === medicalCase.patientUserId || normalizeEmail(user.email) === normalizeEmail(medicalCase.patientEmail)));
  if (!patient) {
    return { status: 'logged', message: 'Medical created, but no active patient login is linked yet.' };
  }
  const settings = await readSettings();
  return sendTemplatedAccountEmail({
    user: patient,
    template: settings.emailTemplates.medicalAssignedToPatient,
    values: { loginUrl: config.publicUrl },
    logStatus: 'patient_medical_assigned_email',
    auditEvent: 'patient_medical_assigned_email_sent',
    auditDetails: { caseId: medicalCase.id }
  });
}

async function sendTemplatedAccountEmail({ user, template, values = {}, logStatus, auditEvent, auditDetails = {} }) {
  const settings = await readSettings();
  const templateValues = {
    appName: settings.appName || config.appName,
    displayName: user.displayName,
    email: user.email,
    loginUrl: config.publicUrl,
    ...values
  };
  const subject = renderEmailTemplate(template.subject, templateValues);
  const text = renderEmailTemplate(template.body, templateValues);
  const smtpSettings = effectiveSmtpSettings(settings);

  if (!smtpSettings.smtp.host) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: `${logStatus}_logged`,
      recipientHash: hashForAudit(user.email),
      subject
    }));
    return { status: 'logged', message: 'Email was logged because SMTP is not configured.' };
  }

  try {
    await sendSmtpMail({
      ...smtpSettings.smtp,
      from: smtpSettings.fromEmail,
      to: [user.email],
      subject,
      text
    });
    await appendAudit(auditEvent, { userId: user.id, ...auditDetails });
    return { status: 'sent', message: `Email sent to ${user.email}.` };
  } catch (error) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: `${logStatus}_failed`,
      recipientHash: hashForAudit(user.email),
      reason: error.message
    }));
    return { status: 'failed', message: `The account was updated, but email delivery failed: ${error.message}` };
  }
}

function renderEmailTemplate(template, values) {
  return String(template || '').replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? '') : match
  ));
}

async function notifyDoctorAssignment(candidate) {
  if (!candidate.assignedClinicianId) {
    return { status: 'skipped', message: 'No doctor is assigned.' };
  }

  const users = await readUsers();
  const doctor = users.find((user) => user.id === candidate.assignedClinicianId && user.active !== false);
  if (!doctor) {
    return { status: 'skipped', message: 'Assigned doctor account was not found.' };
  }

  const settings = await readSettings();
  const recipients = uniqueEmails([doctor.email, ...settings.doctorNotificationEmail.split(',')]);
  const notification = {
    candidateId: candidate.id,
    assignedAt: candidate.assignedAt,
    platformUrl: config.publicUrl,
    notice: 'A new hire profile was assigned for medical assessment.'
  };

  const smtpSettings = effectiveSmtpSettings(settings);
  if (recipients.length === 0 || !smtpSettings.smtp.host) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: 'doctor_assignment_logged',
      recipients,
      notification
    }));
    await appendAudit('doctor_assignment_notification_logged', { candidateId: candidate.id, clinicianId: doctor.id });
    return { status: 'logged', message: 'SMTP is not configured; doctor assignment notification was logged locally.' };
  }

  const message = [
    `Hello ${doctor.displayName},`,
    '',
    'A new hire profile has been assigned to you in the National Commercial Bank Jamaica Medical Platform.',
    '',
    `Candidate profile ID: ${candidate.id}`,
    `Employee/applicant ID: ${candidate.employeeId || 'Not recorded'}`,
    `Assigned at: ${formatDateTime(candidate.assignedAt)}`,
    '',
    'Please sign in to complete and submit the medical assessment:',
    config.publicUrl,
    '',
    'For confidentiality, no medical details are included in this email.'
  ].join('\n');

  try {
    await sendSmtpMail({
      ...smtpSettings.smtp,
      from: smtpSettings.fromEmail,
      to: recipients,
      subject: `${settings.appName || config.appName}: new hire assigned for medical assessment`,
      text: message
    });
    await appendAudit('doctor_assignment_notification_sent', { candidateId: candidate.id, recipientCount: recipients.length });
    return { status: 'sent', message: 'Doctor assignment notification sent.' };
  } catch (error) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: 'doctor_assignment_failed',
      reason: error.message,
      recipients,
      notification
    }));
    await appendAudit('doctor_assignment_notification_failed', { candidateId: candidate.id, reason: error.message });
    return { status: 'failed', message: 'Assignment saved, but doctor email notification failed. Check data/notifications.log.' };
  }
}

async function notifyDoctorFollowUpRequested(submission) {
  return notifySubmissionDoctor(submission, {
    auditPrefix: 'doctor_follow_up',
    logStatus: 'doctor_follow_up_logged',
    sentAudit: 'doctor_follow_up_notification_sent',
    failedAudit: 'doctor_follow_up_notification_failed',
    subject: 'additional information requested',
    notice: 'A reviewer requested additional information on a medical assessment.',
    text(doctor, settings) {
      return [
        `Hello ${doctor.displayName},`,
        '',
        'A reviewer has requested additional information for a medical assessment in the National Commercial Bank Jamaica Medical Platform.',
        '',
        `Submission ID: ${submission.id}`,
        `Candidate profile ID: ${submission.candidate.candidateId || 'Not recorded'}`,
        `Reviewer notes: ${submission.review?.notes || 'Please review the secure record for details.'}`,
        '',
        'Please sign in, open Submitted records, select the form, and use "Edit requested form" to update and resubmit it:',
        config.publicUrl,
        '',
        'For confidentiality, no medical findings are included in this email.'
      ].join('\n');
    }
  });
}

async function notifyDoctorArchived(submission) {
  return notifySubmissionDoctor(submission, {
    auditPrefix: 'doctor_archive',
    logStatus: 'doctor_archive_logged',
    sentAudit: 'doctor_archive_notification_sent',
    failedAudit: 'doctor_archive_notification_failed',
    subject: 'medical assessment reviewed and archived',
    notice: 'A reviewer reviewed and archived a medical assessment.',
    text(doctor, settings) {
      return [
        `Hello ${doctor.displayName},`,
        '',
        'The National Commercial Bank Jamaica reviewer has completed the review and archived the medical assessment.',
        '',
        `Submission ID: ${submission.id}`,
        `Candidate profile ID: ${submission.candidate.candidateId || 'Not recorded'}`,
        `Archived at: ${formatDateTime(submission.review?.reviewedAt)}`,
        '',
        'No further action is required from you at this time.',
        '',
        'For confidentiality, no medical details are included in this email.'
      ].join('\n');
    }
  });
}

async function notifySubmissionDoctor(submission, template) {
  const users = await readUsers();
  const doctor = users.find((user) => user.id === submission.submittedBy && user.active !== false);
  if (!doctor) {
    return { status: 'skipped', message: 'Submitting doctor account was not found.' };
  }

  const settings = await readSettings();
  const recipients = uniqueEmails([doctor.email, ...settings.doctorNotificationEmail.split(',')]);
  const notification = {
    submissionId: submission.id,
    reviewStatus: submission.review?.status || 'pending',
    platformUrl: config.publicUrl,
    notice: template.notice
  };

  const smtpSettings = effectiveSmtpSettings(settings);
  if (recipients.length === 0 || !smtpSettings.smtp.host) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: template.logStatus,
      recipients,
      notification
    }));
    await appendAudit(`${template.auditPrefix}_notification_logged`, { submissionId: submission.id, clinicianId: doctor.id });
    return { status: 'logged', message: 'SMTP is not configured; doctor notification was logged locally.' };
  }

  try {
    await sendSmtpMail({
      ...smtpSettings.smtp,
      from: smtpSettings.fromEmail,
      to: recipients,
      subject: `${settings.appName || config.appName}: ${template.subject}`,
      text: template.text(doctor, settings)
    });
    await appendAudit(template.sentAudit, { submissionId: submission.id, recipientCount: recipients.length });
    return { status: 'sent', message: 'Doctor notification sent.' };
  } catch (error) {
    await appendPrivateLine(NOTIFICATION_LOG_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      status: `${template.auditPrefix}_failed`,
      reason: error.message,
      recipients,
      notification
    }));
    await appendAudit(template.failedAudit, { submissionId: submission.id, reason: error.message });
    return { status: 'failed', message: 'Review status was saved, but the doctor email notification failed. Check data/notifications.log.' };
  }
}

function effectiveSmtpSettings(settings = {}) {
  const mail = settings.mail || {};
  if (mail.enabled && mail.host) {
    return {
      fromEmail: mail.fromEmail || config.fromEmail,
      smtp: {
        host: mail.host,
        port: Number.parseInt(mail.port || '587', 10),
        secure: Boolean(mail.secure),
        user: mail.username || '',
        pass: mail.password || '',
        rejectUnauthorized: mail.rejectUnauthorized !== false
      }
    };
  }
  return {
    fromEmail: config.fromEmail,
    smtp: config.smtp
  };
}

async function sendSmtpMail(options) {
  const socket = await connectSmtp(options);
  let activeSocket = socket;
  let reader = createSmtpReader(activeSocket);

  await expectSmtp(reader, [220]);
  await smtpCommand(activeSocket, reader, `EHLO ${os.hostname() || 'localhost'}`, [250]);

  if (!options.secure) {
    await smtpCommand(activeSocket, reader, 'STARTTLS', [220]);
    activeSocket = tls.connect({
      socket: activeSocket,
      servername: options.host,
      rejectUnauthorized: options.rejectUnauthorized
    });
    reader = createSmtpReader(activeSocket);
    await new Promise((resolve, reject) => {
      activeSocket.once('secureConnect', resolve);
      activeSocket.once('error', reject);
    });
    await smtpCommand(activeSocket, reader, `EHLO ${os.hostname() || 'localhost'}`, [250]);
  }

  if (options.user && options.pass) {
    const token = Buffer.from(`\u0000${options.user}\u0000${options.pass}`).toString('base64');
    await smtpCommand(activeSocket, reader, `AUTH PLAIN ${token}`, [235]);
  }

  await smtpCommand(activeSocket, reader, `MAIL FROM:<${sanitizeEmailAddress(options.from)}>`, [250]);
  for (const recipient of options.to) {
    await smtpCommand(activeSocket, reader, `RCPT TO:<${sanitizeEmailAddress(recipient)}>`, [250, 251]);
  }

  await smtpCommand(activeSocket, reader, 'DATA', [354]);
  activeSocket.write(formatEmailMessage(options));
  await expectSmtp(reader, [250]);
  await smtpCommand(activeSocket, reader, 'QUIT', [221]);
  activeSocket.end();
}

function connectSmtp(options) {
  return new Promise((resolve, reject) => {
    const connectOptions = {
      host: options.host,
      port: options.port,
      servername: options.host,
      rejectUnauthorized: options.rejectUnauthorized
    };
    const socket = options.secure ? tls.connect(connectOptions) : net.connect(connectOptions);
    socket.setTimeout(15000, () => {
      socket.destroy(new Error('SMTP connection timed out.'));
    });
    socket.once('connect', () => {
      if (!options.secure) resolve(socket);
    });
    socket.once('secureConnect', () => {
      if (options.secure) resolve(socket);
    });
    socket.once('error', reject);
  });
}

function createSmtpReader(socket) {
  let buffer = '';
  let current = [];
  const responses = [];
  let waiter = null;

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    parse();
  });

  socket.on('error', (error) => {
    if (waiter) {
      waiter.reject(error);
      waiter = null;
    }
  });

  function parse() {
    let index = buffer.indexOf('\n');
    while (index !== -1) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (line) current.push(line);
      if (/^\d{3} /.test(line)) {
        const response = { code: Number.parseInt(line.slice(0, 3), 10), lines: current };
        current = [];
        if (waiter) {
          const pending = waiter;
          waiter = null;
          pending.resolve(response);
        } else {
          responses.push(response);
        }
      }
      index = buffer.indexOf('\n');
    }
  }

  return {
    read() {
      if (responses.length > 0) return Promise.resolve(responses.shift());
      return new Promise((resolve, reject) => {
        waiter = { resolve, reject };
      });
    }
  };
}

async function smtpCommand(socket, reader, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  return expectSmtp(reader, expectedCodes);
}

async function expectSmtp(reader, expectedCodes) {
  const response = await reader.read();
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP error ${response.code}: ${response.lines.join(' | ')}`);
  }
  return response;
}

function formatEmailMessage(options) {
  const to = options.to.map(sanitizeEmailAddress).join(', ');
  const from = sanitizeEmailAddress(options.from);
  const subject = cleanHeader(options.subject);
  const body = String(options.text || '')
    .split(/\r?\n/)
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');

  return [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${randomToken(16)}@${os.hostname() || 'localhost'}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '.',
    ''
  ].join('\r\n');
}

function sanitizeEmailAddress(value) {
  const address = cleanHeader(value);
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(address) && !/^[^@\s<>]+@localhost$/.test(address)) {
    throw new Error(`Invalid email address: ${address}`);
  }
  return address;
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]/g, '').trim();
}

async function loadSubmissionsForUser(user) {
  const submissions = await loadAllSubmissions();
  if (hasPermission(user, PERMISSIONS.SUBMISSIONS_REVIEW)) return submissions;
  return submissions.filter((submission) => submission.submittedBy === user.id);
}

async function loadCandidatesForUser(user) {
  const candidates = await loadAllCandidates();
  if (hasPermission(user, PERMISSIONS.REPORTS_VIEW)) return candidates;
  if (user.role === ROLES.DOCTOR) {
    const cases = await loadCasesForUser(user);
    const patientIds = new Set(cases.map((medicalCase) => medicalCase.patientId));
    return candidates.filter((candidate) => patientIds.has(candidate.id));
  }
  if (user.role === ROLES.PATIENT) {
    return candidates.filter((candidate) => canPatientUserAccessProfile(user, candidate));
  }
  return [];
}

async function loadCasesForUser(user) {
  const cases = await loadAllMedicalCases();
  if (hasPermission(user, PERMISSIONS.SUBMISSIONS_REVIEW)) return cases;
  if (user.role === ROLES.DOCTOR) {
    const visibleClinicianIds = await medicalOfficeMemberIdsForUser(user);
    return cases.filter((medicalCase) => visibleClinicianIds.has(medicalCase.assignedClinicianId) && ![CASE_STATUSES.ARCHIVED, CASE_STATUSES.WITHDRAWN].includes(medicalCase.status));
  }
  if (user.role === ROLES.PATIENT) {
    const candidates = await loadAllCandidates();
    const patientIds = new Set(candidates.filter((candidate) => canPatientUserAccessProfile(user, candidate)).map((candidate) => candidate.id));
    return cases.filter((medicalCase) => patientIds.has(medicalCase.patientId)
      || medicalCase.patientUserId === user.id
      || normalizeEmail(medicalCase.patientEmail) === normalizeEmail(user.email));
  }
  return [];
}

function canPatientUserAccessProfile(user, candidate) {
  if (!user?.id || !candidate) return false;
  if (candidate.linkedUserId) return candidate.linkedUserId === user.id;
  if (candidate.linkedUserEmail) return candidate.linkedUserEmail.toLowerCase() === user.email;
  if (candidate.loginAccessRevokedAt) return false;
  return Boolean(candidate.email && candidate.email.toLowerCase() === user.email);
}

function paginateApiItems(items, url, searchText, facets = {}) {
  const limit = clampNumber(url.searchParams.get('limit'), 1, 500, 250);
  const offset = clampNumber(url.searchParams.get('offset'), 0, 100000000, 0);
  const query = cleanText(url.searchParams.get('q'), 200).toLowerCase();
  const status = cleanText(url.searchParams.get('status'), 40);
  const paymentStatus = cleanText(url.searchParams.get('paymentStatus'), 40);
  let filtered = Array.isArray(items) ? items : [];
  if (query) filtered = filtered.filter((item) => searchText(item).toLowerCase().includes(query));
  if (status && facets.status) filtered = filtered.filter((item) => facets.status(item) === status);
  if (paymentStatus && facets.paymentStatus) filtered = filtered.filter((item) => facets.paymentStatus(item) === paymentStatus);
  const total = filtered.length;
  return {
    items: filtered.slice(offset, offset + limit),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  };
}

function caseSearchText(item) {
  return [
    item.id,
    item.patientName,
    item.patientEmail,
    item.employeeId,
    item.position,
    item.assignedClinicianName,
    item.status,
    item.paymentStatus
  ].filter(Boolean).join(' ');
}

function candidateSearchText(item) {
  return [
    item.id,
    item.fullName,
    item.email,
    item.employeeId,
    item.nationalId,
    item.contactNumber,
    item.position
  ].filter(Boolean).join(' ');
}

function submissionSearchText(item) {
  return [
    item.id,
    item.caseId,
    item.patientId,
    item.submittedByName,
    item.submittedByEmail,
    item.candidate?.fullName,
    item.candidate?.employeeId
  ].filter(Boolean).join(' ');
}

function userSearchText(item) {
  return [
    item.id,
    item.displayName,
    item.email,
    item.role,
    item.medicalProfile?.facilityName,
    item.medicalProfile?.clinicianName
  ].filter(Boolean).join(' ');
}

function officeSearchText(item) {
  return [
    item.id,
    item.name,
    item.address,
    item.phone,
    item.email
  ].filter(Boolean).join(' ');
}

async function assertCanViewMedicalCase(user, medicalCase) {
  if (hasPermission(user, PERMISSIONS.SUBMISSIONS_REVIEW)) return;
  if (user.role === ROLES.DOCTOR && (await medicalOfficeMemberIdsForUser(user)).has(medicalCase.assignedClinicianId)) return;
  if (user.role === ROLES.PATIENT) {
    const candidate = await loadCandidateById(medicalCase.patientId).catch(() => null);
    if (candidate && canPatientUserAccessProfile(user, candidate)) return;
  }
  throw new HttpError(403, 'You are not authorized to view this medical case.');
}

async function medicalOfficeMemberIdsForUser(user) {
  if (!user?.id) return new Set();
  const ids = new Set([user.id]);
  const offices = await readMedicalOffices();
  offices
    .filter((office) => (office.assignedClinicianIds || []).includes(user.id))
    .forEach((office) => {
      (office.assignedClinicianIds || []).forEach((id) => ids.add(id));
    });
  return ids;
}

async function readMedicalOffices() {
  const offices = await readJsonFile(MEDICAL_OFFICES_PATH, []);
  return Array.isArray(offices) ? offices.map(sanitizeMedicalOffice) : [];
}

async function writeMedicalOffices(offices) {
  await writeJsonFile(MEDICAL_OFFICES_PATH, offices.map(sanitizeMedicalOffice));
}

function sanitizeMedicalOffice(value = {}) {
  return {
    id: cleanText(value.id, 80) || `office_${randomToken(8)}`,
    name: requiredText(value.name || value.facilityName, 'Medical office name', 180),
    address: cleanText(value.address || value.facilityAddress, 500),
    phone: cleanText(value.phone, 50),
    email: cleanText(value.email, 254),
    defaultMedicalFee: cleanMoney(value.defaultMedicalFee || value.medicalFee || value.defaultFee),
    notes: cleanText(value.notes, 1500),
    assignedClinicianIds: Array.isArray(value.assignedClinicianIds)
      ? value.assignedClinicianIds.map((id) => cleanText(id, 80)).filter(Boolean)
      : [],
    active: value.active !== false,
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString()
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(filePath, 0o600);
}

async function loadAllMedicalCases() {
  const files = await fsp.readdir(CASE_DIR).catch(() => []);
  const cases = [];

  for (const file of files.filter((name) => name.endsWith('.json.enc'))) {
    const fullPath = path.join(CASE_DIR, file);
    try {
      const encrypted = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      cases.push(normalizeMedicalCase(decryptJson(encrypted)));
    } catch (error) {
      await appendAudit('case_decrypt_failed', { file, reason: error.message });
    }
  }

  await ensureLegacyCases(cases);
  return cases.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function ensureLegacyCases(cases) {
  const existingIds = new Set(cases.map((medicalCase) => medicalCase.id));
  const patients = await loadAllCandidates();
  for (const patient of patients) {
    if (existingIds.has(patient.id)) continue;
    if (!patient.assignedClinicianId && !patient.submissionId) continue;
    const medicalCase = normalizeMedicalCase({
      id: patient.id,
      legacyCandidateId: patient.id,
      createdAt: patient.createdAt,
      createdBy: patient.createdBy,
      createdByName: patient.createdByName,
      patientId: patient.id,
      patientName: patient.fullName,
      patientEmail: patient.email,
      patientNationalId: patient.nationalId,
      patientDateOfBirth: patient.dateOfBirth,
      patientContactNumber: patient.contactNumber,
      employeeId: patient.employeeId,
      position: patient.position,
      route: CASE_ROUTES.DOCTOR,
      status: legacyCaseStatus(patient.status),
      assignedAt: patient.assignedAt || patient.createdAt,
      assignedClinicianId: patient.assignedClinicianId,
      assignedClinicianName: patient.assignedClinicianName,
      medicationInformation: patient.medicationInformation,
      submissionId: patient.submissionId || '',
      submittedAt: patient.submittedAt || '',
      withdrawalReason: patient.withdrawalReason || ''
    });
    await saveMedicalCase(medicalCase);
    cases.push(medicalCase);
    existingIds.add(medicalCase.id);
  }
}

function legacyCaseStatus(status) {
  return {
    assigned: CASE_STATUSES.SENT_TO_DOCTOR,
    submitted: CASE_STATUSES.DOCTOR_SUBMITTED,
    archived: CASE_STATUSES.ARCHIVED,
    withdrawn: CASE_STATUSES.WITHDRAWN,
    canceled_by_doctor: CASE_STATUSES.CANCELED_BY_DOCTOR
  }[status] || CASE_STATUSES.SENT_TO_DOCTOR;
}

async function loadMedicalCaseById(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpError(400, 'Invalid medical case id.');
  }
  const filePath = path.join(CASE_DIR, `${id}.json.enc`);
  try {
    const encrypted = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return normalizeMedicalCase(decryptJson(encrypted));
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Medical case not found.');
    throw error;
  }
}

async function saveMedicalCase(medicalCase) {
  const normalized = normalizeMedicalCase(medicalCase);
  const filePath = path.join(CASE_DIR, `${normalized.id}.json.enc`);
  const encrypted = encryptJson(normalized);
  await fsp.writeFile(filePath, `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(filePath, 0o600);
  await upsertCaseReportIndex(normalized);
}

async function loadCaseReportIndex() {
  if (caseReportIndexCache) return caseReportIndexCache;
  const index = await readJsonFile(REPORT_CASE_INDEX_PATH, null);
  if (Array.isArray(index)) {
    caseReportIndexCache = index.map(normalizeReportCaseSummary).sort(sortReportCases);
    return caseReportIndexCache;
  }
  return rebuildCaseReportIndex();
}

async function rebuildCaseReportIndex() {
  const cases = await loadAllMedicalCases();
  caseReportIndexCache = cases.map(toReportCaseSummary).sort(sortReportCases);
  await writeCaseReportIndex(caseReportIndexCache);
  return caseReportIndexCache;
}

async function upsertCaseReportIndex(medicalCase) {
  const storedIndex = caseReportIndexCache ? null : await readJsonFile(REPORT_CASE_INDEX_PATH, null);
  if (!caseReportIndexCache && !Array.isArray(storedIndex)) return;
  const current = caseReportIndexCache
    || (Array.isArray(storedIndex) ? storedIndex.map(normalizeReportCaseSummary) : []);
  const summary = toReportCaseSummary(medicalCase);
  const next = current.filter((item) => item.id !== summary.id);
  next.push(summary);
  caseReportIndexCache = next.sort(sortReportCases);
  await writeCaseReportIndex(caseReportIndexCache);
}

async function writeCaseReportIndex(index) {
  await writeJsonFile(REPORT_CASE_INDEX_PATH, index.map(normalizeReportCaseSummary).sort(sortReportCases));
}

function sortReportCases(left, right) {
  return (right.createdAt || '').localeCompare(left.createdAt || '');
}

function toReportCaseSummary(medicalCase) {
  const attachments = Array.isArray(medicalCase.attachments) ? medicalCase.attachments : [];
  return normalizeReportCaseSummary({
    id: medicalCase.id,
    legacyCandidateId: medicalCase.legacyCandidateId,
    createdAt: medicalCase.createdAt,
    updatedAt: medicalCase.updatedAt,
    patientId: medicalCase.patientId,
    patientName: medicalCase.patientName,
    patientEmail: medicalCase.patientEmail,
    employeeId: medicalCase.employeeId,
    position: medicalCase.position,
    route: medicalCase.route,
    status: medicalCase.status,
    assignedAt: medicalCase.assignedAt,
    assignedClinicianId: medicalCase.assignedClinicianId,
    assignedClinicianName: medicalCase.assignedClinicianName,
    submissionId: medicalCase.submissionId,
    submittedAt: medicalCase.submittedAt,
    paymentStatus: medicalCase.paymentStatus,
    payableAmount: medicalCase.payableAmount,
    withdrawalReason: medicalCase.withdrawalReason,
    cancellationReason: medicalCase.cancellationReason,
    canceledAt: medicalCase.canceledAt,
    canceledByName: medicalCase.canceledByName,
    attachmentsCount: attachments.length
  });
}

function normalizeReportCaseSummary(value = {}) {
  const item = value && typeof value === 'object' ? value : {};
  const status = Object.values(CASE_STATUSES).includes(item.status) ? item.status : CASE_STATUSES.DRAFT;
  return {
    id: cleanText(item.id, 80),
    legacyCandidateId: cleanText(item.legacyCandidateId, 80),
    createdAt: cleanText(item.createdAt, 40),
    updatedAt: cleanText(item.updatedAt, 40),
    patientId: cleanText(item.patientId, 80),
    patientUserId: cleanText(item.patientUserId, 80),
    patientName: cleanText(item.patientName, 140),
    patientEmail: cleanText(item.patientEmail, 254).toLowerCase(),
    employeeId: cleanText(item.employeeId, 80),
    position: cleanText(item.position, 140),
    route: Object.values(CASE_ROUTES).includes(item.route) ? item.route : CASE_ROUTES.DOCTOR,
    status,
    assignedAt: cleanText(item.assignedAt, 40),
    assignedClinicianId: cleanText(item.assignedClinicianId, 80),
    assignedClinicianName: cleanText(item.assignedClinicianName, 140),
    submissionId: cleanText(item.submissionId, 80),
    submittedAt: cleanText(item.submittedAt, 40),
    paymentStatus: normalizeCasePaymentStatus(item.paymentStatus, status),
    payableAmount: cleanMoney(item.payableAmount),
    withdrawalReason: cleanText(item.withdrawalReason, 1000),
    cancellationReason: cleanText(item.cancellationReason, 1000),
    canceledAt: cleanText(item.canceledAt, 40),
    canceledByName: cleanText(item.canceledByName, 140),
    attachmentsCount: Math.max(0, Number.parseInt(item.attachmentsCount || '0', 10) || 0)
  };
}

async function buildPatientReportStats() {
  const patients = await loadPatientReportIndex();
  return {
    total: patients.length,
    linked: patients.filter((patient) => patient.linked).length
  };
}

async function loadPatientReportIndex() {
  if (patientReportIndexCache) return patientReportIndexCache;
  const index = await readJsonFile(REPORT_PATIENT_INDEX_PATH, null);
  if (Array.isArray(index)) {
    patientReportIndexCache = index.map(normalizeReportPatientSummary).sort(sortReportPatients);
    return patientReportIndexCache;
  }
  return rebuildPatientReportIndex();
}

async function rebuildPatientReportIndex() {
  const patients = await loadAllCandidates();
  patientReportIndexCache = patients.map(toReportPatientSummary).sort(sortReportPatients);
  await writePatientReportIndex(patientReportIndexCache);
  return patientReportIndexCache;
}

async function upsertPatientReportIndex(patient) {
  const storedIndex = patientReportIndexCache ? null : await readJsonFile(REPORT_PATIENT_INDEX_PATH, null);
  if (!patientReportIndexCache && !Array.isArray(storedIndex)) return;
  const current = patientReportIndexCache
    || (Array.isArray(storedIndex) ? storedIndex.map(normalizeReportPatientSummary) : []);
  const summary = toReportPatientSummary(patient);
  const next = current.filter((item) => item.id !== summary.id);
  next.push(summary);
  patientReportIndexCache = next.sort(sortReportPatients);
  await writePatientReportIndex(patientReportIndexCache);
}

async function writePatientReportIndex(index) {
  await writeJsonFile(REPORT_PATIENT_INDEX_PATH, index.map(normalizeReportPatientSummary).sort(sortReportPatients));
}

function sortReportPatients(left, right) {
  return (right.createdAt || '').localeCompare(left.createdAt || '');
}

function toReportPatientSummary(patient) {
  return normalizeReportPatientSummary({
    id: patient.id,
    createdAt: patient.createdAt,
    linked: Boolean(patient.linkedUserId || patient.linkedUserEmail),
    status: patient.status
  });
}

function normalizeReportPatientSummary(value = {}) {
  const item = value && typeof value === 'object' ? value : {};
  return {
    id: cleanText(item.id, 80),
    createdAt: cleanText(item.createdAt, 40),
    linked: Boolean(item.linked),
    status: cleanText(item.status, 40)
  };
}

function normalizeMedicalCase(medicalCase) {
  const value = medicalCase && typeof medicalCase === 'object' ? medicalCase : {};
  return {
    id: cleanText(value.id, 80),
    legacyCandidateId: cleanText(value.legacyCandidateId, 80),
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
    createdBy: cleanText(value.createdBy, 80),
    createdByName: cleanText(value.createdByName, 140),
    updatedAt: cleanText(value.updatedAt, 40),
    patientId: cleanText(value.patientId, 80),
    patientUserId: cleanText(value.patientUserId, 80),
    patientName: cleanText(value.patientName, 140),
    patientEmail: cleanText(value.patientEmail, 254).toLowerCase(),
    patientNationalId: cleanText(value.patientNationalId, 80),
    patientDateOfBirth: cleanText(value.patientDateOfBirth, 20),
    patientContactNumber: cleanText(value.patientContactNumber, 50),
    employeeId: cleanText(value.employeeId, 80),
    position: cleanText(value.position, 140),
    route: oneOf(value.route || CASE_ROUTES.DOCTOR, Object.values(CASE_ROUTES), 'Case route'),
    status: oneOf(value.status || CASE_STATUSES.DRAFT, Object.values(CASE_STATUSES), 'Case status'),
    assignedAt: cleanText(value.assignedAt, 40),
    assignedClinicianId: cleanText(value.assignedClinicianId, 80),
    assignedClinicianName: cleanText(value.assignedClinicianName, 140),
    medicationInformation: cleanText(value.medicationInformation, 2000),
    submissionId: cleanText(value.submissionId, 80),
    submittedAt: cleanText(value.submittedAt, 40),
    paymentStatus: normalizeCasePaymentStatus(value.paymentStatus, value.status),
    payableAmount: cleanMoney(value.payableAmount),
    customFields: cleanCustomFields(value.customFields),
    withdrawalReason: cleanText(value.withdrawalReason, 1000),
    cancellationReason: cleanText(value.cancellationReason, 1000),
    canceledAt: cleanText(value.canceledAt, 40),
    canceledBy: cleanText(value.canceledBy, 80),
    canceledByName: cleanText(value.canceledByName, 140),
    doctorDraft: sanitizeDoctorDraft(value.doctorDraft || {}),
    patientCaseData: sanitizePatientCaseData(value.patientCaseData || {}),
    attachments: Array.isArray(value.attachments) ? value.attachments.map(sanitizeAttachmentMeta) : []
  };
}

async function sanitizeMedicalCase(payload, user) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const patient = await loadCandidateById(requiredText(body.patientId, 'Patient profile', 80));
  const route = oneOf(body.route || CASE_ROUTES.DOCTOR, Object.values(CASE_ROUTES), 'Case route');
  const assignedClinicianId = cleanText(body.assignedClinicianId, 80);
  if (route === CASE_ROUTES.DOCTOR && !assignedClinicianId) {
    throw new HttpError(400, 'A doctor office is required when routing directly to doctor.');
  }
  const now = new Date().toISOString();
  return normalizeMedicalCase({
    id: `case_${Date.now().toString(36)}_${randomToken(8)}`,
    createdAt: now,
    createdBy: user.id,
    createdByName: user.displayName,
    updatedAt: now,
    patientId: patient.id,
    patientUserId: patient.linkedUserId || '',
    patientName: patient.fullName,
    patientEmail: patient.email,
    patientNationalId: patient.nationalId,
    patientDateOfBirth: patient.dateOfBirth,
    patientContactNumber: patient.contactNumber,
    employeeId: patient.employeeId,
    position: patient.position,
    route,
    status: route === CASE_ROUTES.PATIENT ? CASE_STATUSES.SENT_TO_PATIENT : CASE_STATUSES.SENT_TO_DOCTOR,
    assignedAt: assignedClinicianId ? now : '',
    assignedClinicianId,
    assignedClinicianName: cleanText(body.assignedClinicianName, 140),
    medicationInformation: cleanText(body.medicationInformation || patient.medicationInformation, 2000),
    patientCaseData: patientProfileCaseDefaults(patient),
    customFields: cleanCustomFields(body.customFields)
  });
}

function patientProfileCaseDefaults(patient) {
  const nameParts = splitPatientName(patient.fullName);
  return sanitizePatientCaseData({
    personalInfo: {
      firstName: nameParts.firstName,
      middleInitial: nameParts.middleInitial,
      lastName: nameParts.lastName,
      addressLine1: patient.address,
      mobilePhone: patient.contactNumber,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactNumber: patient.emergencyContactNumber,
      primaryPhysician: patient.primaryPhysician,
      country: 'Jamaica'
    },
    medicalHistory: {
      medications: patient.medicationInformation
    }
  });
}

function splitPatientName(fullName) {
  const parts = cleanText(fullName, 180).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', middleInitial: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleInitial: '', lastName: parts[1] };
  return {
    firstName: parts[0],
    middleInitial: parts[1]?.[0] || '',
    lastName: parts.slice(2).join(' ')
  };
}

function updateMedicalCase(medicalCase, body, user) {
  const now = new Date().toISOString();
  if (hasPermission(user, PERMISSIONS.MEDICAL_CASES_UPDATE)) {
    if (body.route !== undefined) medicalCase.route = oneOf(body.route, Object.values(CASE_ROUTES), 'Case route');
    if (body.status !== undefined) medicalCase.status = oneOf(body.status, Object.values(CASE_STATUSES), 'Case status');
    if (body.assignedClinicianId !== undefined) {
      medicalCase.assignedClinicianId = cleanText(body.assignedClinicianId, 80);
      medicalCase.assignedClinicianName = cleanText(body.assignedClinicianName, 140);
      medicalCase.assignedAt = medicalCase.assignedClinicianId ? now : '';
      if (medicalCase.assignedClinicianId && [CASE_STATUSES.DRAFT, CASE_STATUSES.SENT_TO_PATIENT, CASE_STATUSES.PATIENT_COMPLETED].includes(medicalCase.status)) {
        medicalCase.route = CASE_ROUTES.DOCTOR;
        medicalCase.status = CASE_STATUSES.SENT_TO_DOCTOR;
      }
    }
    if (body.medicationInformation !== undefined) medicalCase.medicationInformation = cleanText(body.medicationInformation, 2000);
    if (body.customFields !== undefined) medicalCase.customFields = cleanCustomFields(body.customFields);
    if (body.withdrawalReason !== undefined) medicalCase.withdrawalReason = cleanText(body.withdrawalReason, 1000);
    if (body.paymentStatus !== undefined) medicalCase.paymentStatus = normalizeCasePaymentStatus(body.paymentStatus, medicalCase.status);
    if (body.payableAmount !== undefined) medicalCase.payableAmount = cleanMoney(body.payableAmount);
    if (medicalCase.status === CASE_STATUSES.DOCTOR_SUBMITTED && body.paymentStatus === undefined) {
      medicalCase.paymentStatus = 'unpaid';
    }
    medicalCase.paymentStatus = normalizeCasePaymentStatus(medicalCase.paymentStatus, medicalCase.status);
  } else if (user.role === ROLES.PATIENT) {
    if (medicalCase.status !== CASE_STATUSES.SENT_TO_PATIENT) {
      throw new HttpError(400, 'This medical case is not waiting for patient action.');
    }
    if (body.patientCaseData !== undefined) {
      medicalCase.patientCaseData = sanitizePatientCaseData(body.patientCaseData);
    }
    if (body.medicationInformation !== undefined) medicalCase.medicationInformation = cleanText(body.medicationInformation, 2000);
    if (body.intent === 'draft') {
      medicalCase.updatedAt = now;
      return;
    }
    if (body.intent === 'submit') {
      const consent = medicalCase.patientCaseData.consent || {};
      if (!consent.accepted || !consent.signedBy || !consent.signedAt || !consent.signatureDataUrl) {
        throw new HttpError(400, 'Consent acceptance and signature are required before submitting patient sections.');
      }
    }
    if (body.assignedClinicianId !== undefined) {
      medicalCase.assignedClinicianId = requiredText(body.assignedClinicianId, 'Doctor office', 80);
      medicalCase.assignedClinicianName = cleanText(body.assignedClinicianName, 140);
      medicalCase.assignedAt = now;
      medicalCase.route = CASE_ROUTES.DOCTOR;
      medicalCase.status = CASE_STATUSES.SENT_TO_DOCTOR;
    } else {
      medicalCase.status = CASE_STATUSES.PATIENT_COMPLETED;
    }
  } else {
    throw new HttpError(403, 'You are not authorized to update this medical case.');
  }
  medicalCase.updatedAt = now;
}

function sanitizeDoctorDraft(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return {
    assessment: sanitizeDraftSection(body.assessment, ['facilityName', 'facilityAddress', 'assessmentDate', 'clinicianName', 'clinicianRegistrationNumber', 'telephoneNumber', 'faxNumber', 'emailAddress'], 260),
    vitals: sanitizeDraftSection(body.vitals, ['heightCm', 'weightKg', 'bloodPressure', 'pulse', 'vision', 'hearing', 'urine'], 180),
    medicalHistory: {
      cardiac: cleanBool(body.medicalHistory?.cardiac),
      respiratory: cleanBool(body.medicalHistory?.respiratory),
      diabetes: cleanBool(body.medicalHistory?.diabetes),
      hypertension: cleanBool(body.medicalHistory?.hypertension),
      allergies: cleanBool(body.medicalHistory?.allergies),
      surgeries: cleanBool(body.medicalHistory?.surgeries),
      medications: cleanBool(body.medicalHistory?.medications),
      mentalHealth: cleanBool(body.medicalHistory?.mentalHealth),
      infectiousDisease: cleanBool(body.medicalHistory?.infectiousDisease),
      notes: cleanText(body.medicalHistory?.notes, 2000)
    },
    familyHistory: {
      hypertension: cleanBool(body.familyHistory?.hypertension),
      diabetes: cleanBool(body.familyHistory?.diabetes),
      heartDisease: cleanBool(body.familyHistory?.heartDisease),
      asthma: cleanBool(body.familyHistory?.asthma),
      cancer: cleanBool(body.familyHistory?.cancer),
      stroke: cleanBool(body.familyHistory?.stroke),
      kidneyDisease: cleanBool(body.familyHistory?.kidneyDisease),
      mentalHealth: cleanBool(body.familyHistory?.mentalHealth),
      notes: cleanText(body.familyHistory?.notes, 2000)
    },
    physicalExam: sanitizeDraftSection(body.physicalExam, PHYSICIAN_EXAM_FIELD_KEYS, 2000),
    labResults: sanitizeDraftSection(body.labResults, ['additionalTests', 'bloodTest', 'urineTest', 'chestXray', 'drugScreen', 'otherTests'], 2000),
    determination: sanitizeDraftSection(body.determination, ['status', 'conclusions', 'restrictions', 'recommendation', 'followUpDate'], 2000),
    customFields: cleanCustomFields(body.customFields),
    attestation: {
      signedBy: cleanText(body.attestation?.signedBy, 140),
      signatureDate: cleanOptionalDate(body.attestation?.signatureDate, 'Signature date'),
      consentConfirmed: cleanBool(body.attestation?.consentConfirmed),
      signatureDataUrl: cleanSignatureDataUrl(body.attestation?.signatureDataUrl)
    }
  };
}

function sanitizePatientCaseData(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  return {
    personalInfo: {
      firstName: cleanText(body.personalInfo?.firstName, 80),
      middleInitial: cleanText(body.personalInfo?.middleInitial, 5),
      lastName: cleanText(body.personalInfo?.lastName, 80),
      sex: cleanText(body.personalInfo?.sex, 40),
      maritalStatus: cleanText(body.personalInfo?.maritalStatus, 40),
      addressLine1: cleanText(body.personalInfo?.addressLine1, 160),
      addressLine2: cleanText(body.personalInfo?.addressLine2, 160),
      cityTown: cleanText(body.personalInfo?.cityTown, 100),
      parish: cleanText(body.personalInfo?.parish, 100),
      country: cleanText(body.personalInfo?.country, 100),
      address: cleanText(body.personalInfo?.address, 260),
      homePhone: cleanText(body.personalInfo?.homePhone, 50),
      mobilePhone: cleanText(body.personalInfo?.mobilePhone, 50),
      workPhone: cleanText(body.personalInfo?.workPhone, 50),
      phoneNumber: cleanText(body.personalInfo?.phoneNumber, 50),
      emergencyContactName: cleanText(body.personalInfo?.emergencyContactName, 140),
      emergencyContactNumber: cleanText(body.personalInfo?.emergencyContactNumber, 50),
      primaryPhysician: cleanText(body.personalInfo?.primaryPhysician, 140),
      primaryPhysicianAddress: cleanText(body.personalInfo?.primaryPhysicianAddress, 260),
      primaryPhysicianPhone: cleanText(body.personalInfo?.primaryPhysicianPhone, 50)
    },
    consent: {
      accepted: cleanBool(body.consent?.accepted),
      signedBy: cleanText(body.consent?.signedBy, 140),
      signedAt: cleanText(body.consent?.signedAt, 40),
      signatureDataUrl: cleanSignatureDataUrl(body.consent?.signatureDataUrl)
    },
    familyHistory: sanitizePatientFamilyHistory(body.familyHistory),
    medicalHistory: sanitizePatientMedicalHistory(body.medicalHistory),
    customFields: cleanCustomFields(body.customFields)
  };
}

function sanitizePatientFamilyHistory(history) {
  const body = history && typeof history === 'object' ? history : {};
  return {
    relatives: sanitizeFamilyRelatives(body.relatives),
    disorders: sanitizeFamilyDisorders(body.disorders, body),
    notes: cleanText(body.notes, 2000)
  };
}

function sanitizeFamilyRelatives(relatives) {
  const rows = Array.isArray(relatives) ? relatives : [];
  return rows.slice(0, 20).map((row) => ({
    relationship: cleanText(row?.relationship, 60),
    age: cleanText(row?.age, 10),
    stateOfHealth: cleanText(row?.stateOfHealth, 500),
    ageAtDeath: cleanText(row?.ageAtDeath, 10)
  })).filter((row) => row.relationship || row.age || row.stateOfHealth || row.ageAtDeath);
}

function sanitizeFamilyDisorders(disorders, legacyHistory = {}) {
  const catalog = [
    ['highBloodPressure', 'High Blood Pressure'],
    ['heartDisease', 'Heart Disease'],
    ['diabetes', 'Diabetes'],
    ['tuberculosis', 'Tuberculosis'],
    ['asthma', 'Asthma'],
    ['cancer', 'Cancer'],
    ['epilepsy', 'Epilepsy'],
    ['mentalDisorders', 'Mental Disorders'],
    ['paralysis', 'Paralysis']
  ];
  const saved = new Map((Array.isArray(disorders) ? disorders : []).map((row) => [cleanText(row?.key, 80), row]));
  return catalog.map(([key, name]) => {
    const row = saved.get(key) || {};
    const answer = ['yes', 'no'].includes(row.answer) ? row.answer : (legacyHistory[key] ? 'yes' : '');
    return {
      key,
      name,
      answer,
      who: cleanText(row.who, 240)
    };
  });
}

function sanitizePatientMedicalHistory(history) {
  const body = history && typeof history === 'object' ? history : {};
  return {
    diseases: sanitizeMedicalDiseases(body.diseases),
    questions: sanitizeMedicalQuestions(body.questions, body),
    previousIllnesses: cleanText(body.previousIllnesses, 2000),
    surgeries: cleanText(body.surgeries, 2000),
    allergies: cleanText(body.allergies, 2000),
    medications: cleanText(body.medications, 2000),
    chronicConditions: cleanText(body.chronicConditions, 2000),
    hospitalizations: cleanText(body.hospitalizations, 2000),
    notes: cleanText(body.notes, 2000)
  };
}

function sanitizeMedicalDiseases(diseases) {
  const catalog = [
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
  ].map((name) => [medicalHistoryKey(name), name]);
  const saved = new Map((Array.isArray(diseases) ? diseases : []).map((row) => [cleanText(row?.key, 100), row]));
  return catalog.map(([key, name]) => {
    const row = saved.get(key) || {};
    const answer = ['yes', 'no'].includes(row.answer) ? row.answer : '';
    return {
      key,
      name,
      answer,
      year: answer === 'yes' ? cleanText(row.year, 10) : ''
    };
  });
}

function sanitizeMedicalQuestions(questions, legacyHistory = {}) {
  const catalog = [
    'currentTreatment',
    'hospitalized',
    'workAbsence',
    'neurologyPsychiatry',
    'regularMedicine',
    'refusedEmployment',
    'smoking',
    'alcohol',
    'futureTreatment',
    'otherHealthInfo'
  ];
  const saved = new Map((Array.isArray(questions) ? questions : []).map((row) => [cleanText(row?.key, 100), row]));
  const legacyDetails = {
    currentTreatment: legacyHistory.chronicConditions,
    hospitalized: legacyHistory.hospitalizations,
    regularMedicine: legacyHistory.medications,
    otherHealthInfo: legacyHistory.notes
  };
  return catalog.map((key) => {
    const row = saved.get(key) || {};
    const detail = cleanText(row.detail || legacyDetails[key], 2000);
    return {
      key,
      type: cleanText(row.type, 40),
      answer: ['yes', 'no'].includes(row.answer) ? row.answer : (detail && !['alcohol', 'otherHealthInfo'].includes(key) ? 'yes' : ''),
      detail,
      value: cleanText(row.value || legacyDetails[key], 2000),
      extras: sanitizeMedicalQuestionExtras(row.extras)
    };
  });
}

function sanitizeMedicalQuestionExtras(extras) {
  const body = extras && typeof extras === 'object' ? extras : {};
  return Object.fromEntries(Object.entries(body).slice(0, 10).map(([key, value]) => [
    cleanText(key, 80),
    cleanText(value, 500)
  ]));
}

function medicalHistoryKey(name) {
  return String(name || '')
    .trim()
    .replace(/[^a-z0-9]+(.)/gi, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

function sanitizeDraftSection(section, keys, maxLength) {
  const value = section && typeof section === 'object' ? section : {};
  return Object.fromEntries(keys.map((key) => [key, cleanText(value[key], maxLength)]));
}

async function assertCanDoctorProcessCase(user, medicalCase) {
  requirePermission(user, PERMISSIONS.MEDICAL_CASES_UPDATE);
  if (user.role !== ROLES.DOCTOR && user.role !== ROLES.ADMIN) {
    throw new HttpError(403, 'Only the assigned doctor office can process this medical case.');
  }
  if (user.role !== ROLES.ADMIN && !(await medicalOfficeMemberIdsForUser(user)).has(medicalCase.assignedClinicianId)) {
    throw new HttpError(403, 'This medical case is not assigned to your account.');
  }
  if (!medicalCase.patientId) {
    throw new HttpError(400, 'This medical case is not linked to a patient profile.');
  }
  if ([CASE_STATUSES.ARCHIVED, CASE_STATUSES.WITHDRAWN, CASE_STATUSES.CANCELED_BY_DOCTOR].includes(medicalCase.status)) {
    throw new HttpError(400, 'This medical case can no longer be processed.');
  }
}

async function saveCaseAttachment(medicalCase, body, user) {
  const fileName = safeFileName(requiredText(body.fileName, 'Attachment file name', 180));
  const contentType = oneOf(body.contentType, ['image/png', 'image/jpeg', 'image/webp'], 'Attachment type');
  const dataUrl = cleanText(body.dataUrl, config.maxBodyBytes);
  const match = dataUrl.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match || match[1] !== contentType) throw new HttpError(400, 'Attachment data is invalid.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new HttpError(400, 'Attachment must be 1 byte to 4 MB.');
  const id = `att_${Date.now().toString(36)}_${randomToken(8)}`;
  const caseDir = path.join(ATTACHMENT_DIR, medicalCase.id);
  ensurePrivateDirectory(caseDir);
  const storedName = `${id}-${fileName}`;
  await fsp.writeFile(path.join(caseDir, storedName), buffer, { mode: 0o600 });
  return sanitizeAttachmentMeta({
    id,
    fileName,
    storedName,
    contentType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.id,
    uploadedByName: user.displayName
  });
}

function sanitizeAttachmentMeta(value) {
  const item = value && typeof value === 'object' ? value : {};
  return {
    id: cleanText(item.id, 80),
    fileName: cleanText(item.fileName, 180),
    storedName: cleanText(item.storedName, 260),
    contentType: cleanText(item.contentType, 80),
    size: Number.parseInt(item.size || '0', 10) || 0,
    uploadedAt: cleanText(item.uploadedAt, 40),
    uploadedBy: cleanText(item.uploadedBy, 80),
    uploadedByName: cleanText(item.uploadedByName, 140)
  };
}

async function assertCanUpdateMedicalCase(user, medicalCase) {
  if ([ROLES.ADMIN, ROLES.REVIEWER].includes(user.role) && hasPermission(user, PERMISSIONS.MEDICAL_CASES_UPDATE)) return;
  if (user.role === ROLES.PATIENT && hasPermission(user, PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE)) {
    const candidates = await loadAllCandidates();
    const patient = candidates.find((candidate) => candidate.id === medicalCase.patientId);
    if ((patient && canPatientUserAccessProfile(user, patient))
      || medicalCase.patientUserId === user.id
      || normalizeEmail(medicalCase.patientEmail) === normalizeEmail(user.email)) return;
  }
  if (user.role === ROLES.DOCTOR && hasPermission(user, PERMISSIONS.MEDICAL_CASES_UPDATE) && (await medicalOfficeMemberIdsForUser(user)).has(medicalCase.assignedClinicianId)) return;
  throw new HttpError(403, 'You are not authorized to update this medical case.');
}

async function loadMedicalCaseForSubmission(body, user) {
  const candidate = body?.candidate || {};
  const caseId = cleanText(candidate.caseId || candidate.candidateId, 80);
  if (!caseId) throw new HttpError(400, 'A medical case must be selected before submitting an assessment.');
  const medicalCase = await loadMedicalCaseById(caseId);
  await assertCanDoctorProcessCase(user, medicalCase);
  if (![CASE_STATUSES.SENT_TO_DOCTOR, CASE_STATUSES.DOCTOR_SUBMITTED, CASE_STATUSES.REVIEW_PENDING].includes(medicalCase.status)) {
    throw new HttpError(400, 'This medical case is not ready for doctor assessment.');
  }
  return medicalCase;
}

async function loadAllCandidates() {
  const files = await fsp.readdir(CANDIDATE_DIR).catch(() => []);
  const candidates = [];

  for (const file of files.filter((name) => name.endsWith('.json.enc'))) {
    const fullPath = path.join(CANDIDATE_DIR, file);
    try {
      const encrypted = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      candidates.push(decryptJson(encrypted));
    } catch (error) {
      await appendAudit('candidate_decrypt_failed', { file, reason: error.message });
    }
  }

  return candidates.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function loadCandidateById(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpError(400, 'Invalid candidate id.');
  }
  const filePath = path.join(CANDIDATE_DIR, `${id}.json.enc`);
  try {
    const encrypted = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return decryptJson(encrypted);
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Candidate not found.');
    throw error;
  }
}

async function saveCandidate(candidate) {
  const filePath = path.join(CANDIDATE_DIR, `${candidate.id}.json.enc`);
  const encrypted = encryptJson(candidate);
  await fsp.writeFile(filePath, `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(filePath, 0o600);
  await upsertPatientReportIndex(candidate);
}

function sanitizeCandidate(payload, user) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const now = new Date().toISOString();
  return {
    id: `cand_${Date.now().toString(36)}_${randomToken(8)}`,
    createdAt: now,
    createdBy: user.id,
    createdByName: user.displayName,
    assignedAt: now,
    assignedClinicianId: cleanText(body.assignedClinicianId, 80),
    assignedClinicianName: cleanText(body.assignedClinicianName, 140),
    status: 'assigned',
    withdrawalReason: '',
    submittedAt: '',
    submissionId: '',
    fullName: requiredText(body.fullName, 'Candidate full name', 140),
    employeeId: cleanText(body.employeeId, 80),
    nationalId: cleanText(body.nationalId, 80),
    dateOfBirth: requiredDate(body.dateOfBirth, 'Date of birth'),
    email: cleanText(body.email, 254),
    contactNumber: cleanText(body.contactNumber, 50),
    address: cleanText(body.address, 260),
    emergencyContactName: cleanText(body.emergencyContactName, 140),
    emergencyContactNumber: cleanText(body.emergencyContactNumber, 50),
    primaryPhysician: cleanText(body.primaryPhysician, 140),
    position: requiredText(body.position, 'Position applied for', 140),
    medicationInformation: cleanText(body.medicationInformation, 2000)
  };
}

function updateCandidateFromReviewer(candidate, body) {
  if (body.fullName !== undefined) candidate.fullName = requiredText(body.fullName, 'Candidate full name', 140);
  if (body.employeeId !== undefined) candidate.employeeId = cleanText(body.employeeId, 80);
  if (body.nationalId !== undefined) candidate.nationalId = cleanText(body.nationalId, 80);
  if (body.dateOfBirth !== undefined) candidate.dateOfBirth = requiredDate(body.dateOfBirth, 'Date of birth');
  if (body.email !== undefined) candidate.email = cleanText(body.email, 254);
  if (body.contactNumber !== undefined) candidate.contactNumber = cleanText(body.contactNumber, 50);
  if (body.address !== undefined) candidate.address = cleanText(body.address, 260);
  if (body.emergencyContactName !== undefined) candidate.emergencyContactName = cleanText(body.emergencyContactName, 140);
  if (body.emergencyContactNumber !== undefined) candidate.emergencyContactNumber = cleanText(body.emergencyContactNumber, 50);
  if (body.primaryPhysician !== undefined) candidate.primaryPhysician = cleanText(body.primaryPhysician, 140);
  if (body.position !== undefined) candidate.position = requiredText(body.position, 'Position applied for', 140);
  if (body.medicationInformation !== undefined) candidate.medicationInformation = cleanText(body.medicationInformation, 2000);
  if (body.assignedClinicianId !== undefined) {
    candidate.assignedClinicianId = cleanText(body.assignedClinicianId, 80);
    candidate.assignedClinicianName = cleanText(body.assignedClinicianName, 140);
    candidate.assignedAt = new Date().toISOString();
    if (candidate.status === 'withdrawn') candidate.status = 'assigned';
  }
  if (body.status !== undefined) {
    candidate.status = oneOf(body.status, ['assigned', 'submitted', 'withdrawn', 'archived'], 'Candidate status');
  }
  if (body.withdrawalReason !== undefined) candidate.withdrawalReason = cleanText(body.withdrawalReason, 1000);
}

function updateCandidateFromClinician(candidate, body) {
  if (body.medicationInformation !== undefined) {
    candidate.medicationInformation = cleanText(body.medicationInformation, 2000);
  }
  if (body.status !== undefined) {
    const status = oneOf(body.status, ['assigned', 'withdrawn'], 'Candidate status');
    candidate.status = status;
    if (status === 'withdrawn') {
      candidate.withdrawnAt = new Date().toISOString();
      candidate.withdrawnBy = body.withdrawnBy || 'doctor';
    }
  }
  if (body.withdrawalReason !== undefined) {
    candidate.withdrawalReason = cleanText(body.withdrawalReason, 1000);
  }
}

function updateCandidateFromPatient(candidate, body) {
  if (body.email !== undefined) candidate.email = cleanText(body.email, 254);
  if (body.contactNumber !== undefined) candidate.contactNumber = cleanText(body.contactNumber, 50);
  if (body.address !== undefined) candidate.address = cleanText(body.address, 260);
  if (body.emergencyContactName !== undefined) candidate.emergencyContactName = cleanText(body.emergencyContactName, 140);
  if (body.emergencyContactNumber !== undefined) candidate.emergencyContactNumber = cleanText(body.emergencyContactNumber, 50);
  if (body.primaryPhysician !== undefined) candidate.primaryPhysician = cleanText(body.primaryPhysician, 140);
}

async function markCandidateSubmitted(candidateId, submissionId, user, medicationInformation = '') {
  const candidate = await loadCandidateById(candidateId);
  if (candidate.assignedClinicianId && candidate.assignedClinicianId !== user.id && user.role !== ROLES.ADMIN) {
    throw new HttpError(403, 'This candidate is not assigned to your account.');
  }
  candidate.status = 'submitted';
  candidate.submittedAt = new Date().toISOString();
  candidate.submissionId = submissionId;
  candidate.medicationInformation = cleanText(medicationInformation, 2000);
  await saveCandidate(candidate);
}

async function markCaseSubmitted(medicalCase, submissionId, user, medicationInformation = '') {
  if (medicalCase.assignedClinicianId && medicalCase.assignedClinicianId !== user.id && user.role !== ROLES.ADMIN) {
    throw new HttpError(403, 'This medical case is not assigned to your account.');
  }
  assertDoctorCanSubmitFinalMedical(medicalCase, user);
  medicalCase.status = CASE_STATUSES.DOCTOR_SUBMITTED;
  medicalCase.submittedAt = new Date().toISOString();
  medicalCase.submissionId = submissionId;
  medicalCase.medicationInformation = cleanText(medicationInformation, 2000);
  medicalCase.paymentStatus = normalizeCasePaymentStatus('unpaid', medicalCase.status);
  if (!medicalCase.payableAmount) {
    medicalCase.payableAmount = await resolveMedicalCasePayableAmount(medicalCase, user);
  }
  await saveMedicalCase(medicalCase);
  await appendAudit('medical_case_billing_marked_unpaid', {
    caseId: medicalCase.id,
    submissionId,
    userId: user.id,
    payableAmount: medicalCase.payableAmount
  });
}

function assertDoctorCanSubmitFinalMedical(medicalCase, user) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role !== ROLES.DOCTOR || !isDoctorOfficeUser(user)) {
    throw new HttpError(403, 'Only a doctor assigned to the medical office can finally submit this medical.');
  }
  if (medicalCase.assignedClinicianId && medicalCase.assignedClinicianId !== user.id) {
    throw new HttpError(403, 'This medical case is not assigned to your account.');
  }
}

function isDoctorOfficeUser(user) {
  return (user?.medicalProfile?.officeUserType || 'doctor') === 'doctor';
}

async function resolveMedicalCasePayableAmount(medicalCase, doctorUser) {
  const doctorFee = isDoctorOfficeUser(doctorUser) ? cleanMoney(doctorUser?.medicalProfile?.defaultMedicalFee) : 0;
  if (doctorFee > 0) return doctorFee;

  const clinicianId = cleanText(medicalCase?.assignedClinicianId || doctorUser?.id, 80);
  if (!clinicianId) return 0;

  const offices = await readMedicalOffices();
  const office = offices.find((item) => (item.assignedClinicianIds || []).includes(clinicianId));
  return cleanMoney(office?.defaultMedicalFee);
}

function toCandidateSummary(candidate) {
  return {
    id: candidate.id,
    createdAt: candidate.createdAt,
    assignedAt: candidate.assignedAt,
    assignedClinicianId: candidate.assignedClinicianId,
    assignedClinicianName: candidate.assignedClinicianName,
    status: candidate.status,
    withdrawalReason: candidate.withdrawalReason,
    submittedAt: candidate.submittedAt,
    submissionId: candidate.submissionId,
    fullName: candidate.fullName,
    employeeId: candidate.employeeId,
    nationalId: candidate.nationalId,
    dateOfBirth: candidate.dateOfBirth,
    email: candidate.email,
    contactNumber: candidate.contactNumber,
    address: candidate.address,
    emergencyContactName: candidate.emergencyContactName,
    emergencyContactNumber: candidate.emergencyContactNumber,
    primaryPhysician: candidate.primaryPhysician,
    position: candidate.position,
    medicationInformation: candidate.medicationInformation,
    linkedUserId: candidate.linkedUserId || '',
    linkedUserEmail: candidate.linkedUserEmail || ''
  };
}

function toCaseSummary(medicalCase) {
  return {
    id: medicalCase.id,
    legacyCandidateId: medicalCase.legacyCandidateId,
    createdAt: medicalCase.createdAt,
    updatedAt: medicalCase.updatedAt,
    patientId: medicalCase.patientId,
    patientName: medicalCase.patientName,
    patientEmail: medicalCase.patientEmail,
    patientNationalId: medicalCase.patientNationalId,
    patientDateOfBirth: medicalCase.patientDateOfBirth,
    patientContactNumber: medicalCase.patientContactNumber,
    employeeId: medicalCase.employeeId,
    position: medicalCase.position,
    route: medicalCase.route,
    status: medicalCase.status,
    assignedAt: medicalCase.assignedAt,
    assignedClinicianId: medicalCase.assignedClinicianId,
    assignedClinicianName: medicalCase.assignedClinicianName,
    medicationInformation: medicalCase.medicationInformation,
    submissionId: medicalCase.submissionId,
    submittedAt: medicalCase.submittedAt,
    paymentStatus: medicalCase.paymentStatus,
    payableAmount: medicalCase.payableAmount,
    customFields: medicalCase.customFields || {},
    withdrawalReason: medicalCase.withdrawalReason,
    cancellationReason: medicalCase.cancellationReason,
    canceledAt: medicalCase.canceledAt,
    canceledByName: medicalCase.canceledByName,
    doctorDraft: medicalCase.doctorDraft,
    patientCaseData: medicalCase.patientCaseData,
    attachments: medicalCase.attachments
  };
}

function buildMonthlyDoctorReport(cases, submissions, users, offices = []) {
  const doctors = new Map(users.filter((user) => user.role === ROLES.DOCTOR).map((user) => [user.id, user]));
  const submissionCounts = new Map();
  for (const submission of submissions) {
    const month = monthKey(submission.submittedAt);
    const key = `${submission.submittedBy}:${month}`;
    submissionCounts.set(key, (submissionCounts.get(key) || 0) + 1);
  }

  const rows = new Map();
  for (const medicalCase of cases) {
    const doctorId = medicalCase.assignedClinicianId || 'unassigned';
    const month = monthKey(medicalCase.assignedAt || medicalCase.createdAt);
    const key = `${doctorId}:${month}`;
    const existing = rows.get(key) || {
      month,
      doctorId,
      doctorName: doctors.get(doctorId)?.displayName || medicalCase.assignedClinicianName || 'Unassigned',
      assignedCount: 0,
      submittedCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      dueAmount: 0
    };
    existing.assignedCount += 1;
    existing.submittedCount = submissionCounts.get(key) || existing.submittedCount;
    if (['doctor_submitted', 'review_pending', 'reviewed', 'archived'].includes(medicalCase.status)) {
      const paymentStatus = normalizeCasePaymentStatus(medicalCase.paymentStatus, medicalCase.status);
      if (paymentStatus === 'paid') existing.paidCount += 1;
      if (paymentStatus === 'unpaid') {
        existing.unpaidCount += 1;
        existing.dueAmount += reportCasePayableAmount(medicalCase, doctors, offices);
      }
    }
    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((left, right) => {
    const monthOrder = right.month.localeCompare(left.month);
    if (monthOrder !== 0) return monthOrder;
    return left.doctorName.localeCompare(right.doctorName);
  });
}

function doctorCaseReportRow(submission, medicalCase = {}) {
  const status = medicalCase.status || 'doctor_submitted';
  return {
    id: medicalCase.id || submission.caseId,
    submissionId: submission.id,
    patientName: medicalCase.patientName || submission.candidate?.fullName || '',
    employeeId: medicalCase.employeeId || submission.candidate?.employeeId || '',
    position: medicalCase.position || submission.candidate?.position || '',
    submittedAt: submission.submittedAt || medicalCase.submittedAt || '',
    assignedAt: medicalCase.assignedAt || '',
    updatedAt: medicalCase.updatedAt || submission.submittedAt || '',
    status,
    paymentStatus: normalizeCasePaymentStatus(medicalCase.paymentStatus, status),
    payableAmount: cleanMoney(medicalCase.payableAmount),
    determinationStatus: submission.determination?.status || '',
    reviewStatus: submission.review?.status || 'pending',
    reviewNotes: cleanText(submission.review?.notes, 1500),
    facilityName: submission.assessment?.facilityName || '',
    clinicianName: submission.assessment?.clinicianName || submission.submittedByName || ''
  };
}

function doctorCaseReportSummary(rows) {
  const payableRows = rows.filter((item) => item.paymentStatus !== 'not_payable');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const turnaroundHours = rows
    .map((item) => {
      const assigned = Date.parse(item.assignedAt);
      const submitted = Date.parse(item.submittedAt);
      return Number.isFinite(assigned) && Number.isFinite(submitted) && submitted >= assigned
        ? (submitted - assigned) / 3600000
        : null;
    })
    .filter((value) => value !== null);
  return {
    processed: rows.length,
    processedThisMonth: rows.filter((item) => String(item.submittedAt || '').slice(0, 7) === currentMonth).length,
    pendingHrReview: rows.filter((item) => ['doctor_submitted', 'review_pending'].includes(item.status)).length,
    unpaidCount: payableRows.filter((item) => item.paymentStatus === 'unpaid').length,
    unpaidAmount: payableRows
      .filter((item) => item.paymentStatus === 'unpaid')
      .reduce((total, item) => total + cleanMoney(item.payableAmount), 0),
    paidCount: payableRows.filter((item) => item.paymentStatus === 'paid').length,
    followUpCount: rows.filter((item) => item.reviewStatus === 'needs_follow_up').length,
    averageTurnaroundHours: turnaroundHours.length
      ? Math.round(turnaroundHours.reduce((total, value) => total + value, 0) / turnaroundHours.length)
      : 0
  };
}

function doctorCaseReportSearchText(item) {
  return [
    item.id,
    item.submissionId,
    item.patientName,
    item.employeeId,
    item.position,
    item.status,
    item.paymentStatus,
    item.determinationStatus,
    item.reviewStatus,
    item.facilityName
  ].filter(Boolean).join(' ');
}

function reportCasePayableAmount(medicalCase, doctors, offices) {
  const recordedAmount = cleanMoney(medicalCase.payableAmount);
  if (recordedAmount > 0) return recordedAmount;
  const doctor = doctors.get(medicalCase.assignedClinicianId);
  const doctorFee = isDoctorOfficeUser(doctor) ? cleanMoney(doctor?.medicalProfile?.defaultMedicalFee) : 0;
  if (doctorFee > 0) return doctorFee;
  const office = offices.find((item) => (item.assignedClinicianIds || []).includes(medicalCase.assignedClinicianId));
  return cleanMoney(office?.defaultMedicalFee);
}

function monthKey(value) {
  return cleanText(value, 30).slice(0, 7) || 'unknown';
}

async function loadAllSubmissions() {
  const files = await fsp.readdir(SUBMISSION_DIR).catch(() => []);
  const submissions = [];

  for (const file of files.filter((name) => name.endsWith('.json.enc'))) {
    const fullPath = path.join(SUBMISSION_DIR, file);
    try {
      const encrypted = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      submissions.push(normalizeSubmissionRelationships(decryptJson(encrypted)));
    } catch (error) {
      await appendAudit('submission_decrypt_failed', { file, reason: error.message });
    }
  }

  return submissions.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

async function loadSubmissionById(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpError(400, 'Invalid submission id.');
  }
  const filePath = path.join(SUBMISSION_DIR, `${id}.json.enc`);
  try {
    const encrypted = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return normalizeSubmissionRelationships(decryptJson(encrypted));
  } catch (error) {
    if (error.code === 'ENOENT') throw new HttpError(404, 'Submission not found.');
    throw error;
  }
}

async function saveSubmission(submission) {
  const filePath = path.join(SUBMISSION_DIR, `${submission.id}.json.enc`);
  const encrypted = encryptJson(submission);
  await fsp.writeFile(filePath, `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(filePath, 0o600);
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptJson(record) {
  if (!record || record.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported encrypted record.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

function toSubmissionSummary(submission) {
  return {
    id: submission.id,
    caseId: submission.caseId || submission.candidate?.caseId || submission.candidate?.candidateId || '',
    patientId: submission.patientId || submission.candidate?.patientId || '',
    submittedAt: submission.submittedAt,
    submittedByName: submission.submittedByName,
    candidateName: submission.candidate.fullName,
    employeeId: submission.candidate.employeeId,
    position: submission.candidate.position,
    facilityName: submission.assessment.facilityName,
    clinicianName: submission.assessment.clinicianName,
    determinationStatus: submission.determination.status,
    reviewStatus: submission.review?.status || 'pending'
  };
}

function normalizeSubmissionRelationships(submission) {
  if (!submission || typeof submission !== 'object') return submission;
  const candidate = submission.candidate || {};
  const caseId = cleanText(submission.caseId || candidate.caseId || candidate.candidateId, 80);
  const patientId = cleanText(submission.patientId || candidate.patientId || candidate.candidateId, 80);
  return {
    ...submission,
    caseId,
    patientId,
    candidate: {
      ...candidate,
      candidateId: cleanText(candidate.candidateId || caseId, 80),
      caseId,
      patientId
    }
  };
}

function assertCanViewSubmission(user, submission) {
  requirePermission(user, PERMISSIONS.SUBMISSIONS_VIEW);
  if (hasPermission(user, PERMISSIONS.SUBMISSIONS_REVIEW)) return;
  if (submission.submittedBy === user.id) return;
  throw new HttpError(403, 'You are not authorized to view this submission.');
}

function assertCanEditFollowUp(user, submission) {
  requirePermission(user, PERMISSIONS.SUBMISSIONS_FOLLOW_UP);
  if (user.role !== ROLES.ADMIN && submission.submittedBy !== user.id) {
    throw new HttpError(403, 'This form was not submitted by your account.');
  }
  if (submission.review?.status !== 'needs_follow_up') {
    throw new HttpError(400, 'This form can only be edited after a reviewer marks it as Needs follow-up.');
  }
}

async function requireAuth(req, res = null) {
  const cookie = parseCookies(req.headers.cookie || '').sid;
  if (!cookie) throw new HttpError(401, 'Authentication is required.');

  const [sessionId, signature] = cookie.split('.');
  if (!sessionId || !signature || !safeEqual(signature, sign(sessionId))) {
    throw new HttpError(401, 'Authentication is required.');
  }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    if (res) res.setHeader('Set-Cookie', clearSessionCookie());
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  session.lastActivityAt = Date.now();
  session.expiresAt = Date.now() + config.sessionTtlMs;
  if (res) res.setHeader('Set-Cookie', makeSessionCookie(sessionId));
  const users = await readUsers();
  const user = users.find((candidate) => candidate.id === session.userId && candidate.active !== false);
  if (!user) throw new HttpError(401, 'User account is not active.');

  return { sessionId, session, user };
}

function verifyCsrf(req, session) {
  const token = req.headers['x-csrf-token'];
  if (!token || !safeEqual(String(token), session.csrfToken)) {
    throw new HttpError(403, 'Security token is invalid or missing.');
  }
}

function makeSessionCookie(sessionId) {
  const value = `${sessionId}.${sign(sessionId)}`;
  const parts = [
    `sid=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`
  ];
  if (config.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  const parts = ['sid=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (config.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function sign(value) {
  return crypto.createHmac('sha256', masterKey).update(value).digest('base64url');
}

function parseCookies(header) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

async function ensureUsers() {
  if (fs.existsSync(USERS_PATH)) {
    await readUsers();
    return;
  }

  const reviewerPassword = env.INIT_REVIEWER_PASSWORD || randomReadablePassword();
  const clinicianPassword = env.INIT_CLINICIAN_PASSWORD || randomReadablePassword();
  const adminPassword = env.INIT_ADMIN_PASSWORD || randomReadablePassword();
  const users = [
    createUser({
      email: (env.INIT_REVIEWER_EMAIL || 'hr-review@ncb.local').toLowerCase(),
      displayName: 'HR Reviewer',
      role: ROLES.REVIEWER,
      password: reviewerPassword
    }),
    createUser({
      email: (env.INIT_CLINICIAN_EMAIL || 'doctor@ncb.local').toLowerCase(),
      displayName: 'Medical Clinician',
      role: ROLES.DOCTOR,
      password: clinicianPassword
    }),
    createUser({
      email: (env.INIT_ADMIN_EMAIL || 'admin@ncb.local').toLowerCase(),
      displayName: 'System Administrator',
      role: ROLES.ADMIN,
      password: adminPassword
    })
  ];

  await writeUsers(users);

  const credentialText = [
    'Initial local credentials',
    'Keep this file private and delete it after creating permanent accounts.',
    '',
    `Reviewer login: ${users[0].email}`,
    `Reviewer password: ${reviewerPassword}`,
    '',
    `Clinician login: ${users[1].email}`,
    `Clinician password: ${clinicianPassword}`,
    '',
    `Administrator login: ${users[2].email}`,
    `Administrator password: ${adminPassword}`,
    ''
  ].join('\n');
  await fsp.writeFile(BOOTSTRAP_PATH, credentialText, { mode: 0o600 });
  await safeChmod(BOOTSTRAP_PATH, 0o600);
  console.log(`First-run credentials were written to ${BOOTSTRAP_PATH}`);
}

async function ensureSettings() {
  if (fs.existsSync(SETTINGS_PATH)) {
    await readSettings();
    return;
  }
  await writeSettings(defaultSettings);
}

async function resolveStartupDatabaseConfig() {
  let savedDatabase = defaultSettings.database;
  if (fs.existsSync(SETTINGS_PATH)) {
    const persisted = JSON.parse(await fsp.readFile(SETTINGS_PATH, 'utf8'));
    savedDatabase = sanitizeDatabaseSettings(hydrateSettingsSecrets(persisted).database || defaultSettings.database);
  }
  const requestedSource = cleanText(env.DATABASE_CONFIG_SOURCE, 20)
    || savedDatabase.source
    || (stringToBool(env.DATABASE_ENABLED) ? 'environment' : 'settings');
  if (requestedSource === 'settings') {
    return databaseConfigFromSettings(savedDatabase, config.appName);
  }
  return databaseConfig(env);
}

async function ensureDemoDoctorCase() {
  const users = await readUsers();
  const doctor = users.find((user) => user.role === ROLES.DOCTOR && user.email === 'doctor@ncb.local') || users.find((user) => user.role === ROLES.DOCTOR);
  const reviewer = users.find((user) => user.role === ROLES.REVIEWER) || users.find((user) => user.role === ROLES.ADMIN) || doctor;
  if (!doctor || !reviewer) return;

  const cases = await loadAllMedicalCases();
  const candidates = await loadAllCandidates();
  const now = new Date().toISOString();
  const demos = [
    {
      slug: 'doctor_demo_001',
      fullName: 'Alicia Brown',
      employeeId: 'DEMO-DR-001',
      nationalId: '123-456-789',
      dateOfBirth: '1994-05-12',
      email: 'doctor.demo.alicia@ncb.local',
      contactNumber: '(876) 555-0101',
      address: '12 Hope Road, Kingston 6',
      emergencyContactName: 'Marcia Brown',
      emergencyContactNumber: '(876) 555-0199',
      position: 'Client Service Officer',
      sex: 'Female',
      maritalStatus: 'Single',
      familyNotes: 'Mother has hypertension. Father is alive and well.',
      medicine: 'Loratadine as needed for allergies.',
      diseases: [{ key: 'hayFeverAllergicRhinitis', name: 'Hay Fever (Allergic Rhinitis)', answer: 'yes', year: '2021' }],
      questions: [{ key: 'regularMedicine', answer: 'yes', detail: 'Loratadine as needed for allergies.' }]
    },
    {
      slug: 'doctor_demo_002',
      fullName: 'Dwayne Campbell',
      employeeId: 'DEMO-DR-002',
      nationalId: '987-654-321',
      dateOfBirth: '1989-11-03',
      email: 'doctor.demo.dwayne@ncb.local',
      contactNumber: '(876) 555-0124',
      address: '8 Molynes Road, Kingston 10',
      emergencyContactName: 'Tanya Campbell',
      emergencyContactNumber: '(876) 555-0144',
      position: 'Operations Analyst',
      sex: 'Male',
      maritalStatus: 'Married',
      familyNotes: 'Father has diabetes. One sibling has asthma.',
      medicine: '',
      diseases: [{ key: 'frequentHeadaches', name: 'Frequent headaches', answer: 'yes', year: '2020' }],
      questions: [{ key: 'hospitalized', answer: 'yes', detail: 'Appendectomy at UHWI in 2014.' }]
    },
    {
      slug: 'doctor_demo_003',
      fullName: 'Monique Reid',
      employeeId: 'DEMO-DR-003',
      nationalId: '555-222-111',
      dateOfBirth: '1997-02-18',
      email: 'doctor.demo.monique@ncb.local',
      contactNumber: '(876) 555-0188',
      address: 'Portmore, St. Catherine',
      emergencyContactName: 'Andre Reid',
      emergencyContactNumber: '(876) 555-0166',
      position: 'Digital Banking Associate',
      sex: 'Female',
      maritalStatus: 'Single',
      familyNotes: 'No significant family illnesses reported.',
      medicine: 'None reported.',
      diseases: [],
      questions: [{ key: 'otherHealthInfo', type: 'textarea', value: 'Patient reports no current symptoms.' }]
    }
  ];

  for (const demo of demos) {
    let patient = candidates.find((candidate) => candidate.email === demo.email);
    if (!patient) {
      patient = {
        id: `cand_${demo.slug}`,
        createdAt: now,
        createdBy: reviewer.id,
        createdByName: reviewer.displayName,
        assignedAt: now,
        assignedClinicianId: doctor.id,
        assignedClinicianName: doctor.displayName,
        status: 'assigned',
        withdrawalReason: '',
        submittedAt: '',
        submissionId: '',
        fullName: demo.fullName,
        employeeId: demo.employeeId,
        nationalId: demo.nationalId,
        dateOfBirth: demo.dateOfBirth,
        email: demo.email,
        contactNumber: demo.contactNumber,
        address: demo.address,
        emergencyContactName: demo.emergencyContactName,
        emergencyContactNumber: demo.emergencyContactNumber,
        primaryPhysician: 'Dr. Karen Lewis',
        position: demo.position,
        medicationInformation: demo.medicine
      };
      await saveCandidate(patient);
      candidates.push(patient);
    }

    const caseId = `case_${demo.slug}`;
    if (cases.some((medicalCase) => medicalCase.id === caseId)) continue;
    await saveMedicalCase({
      id: caseId,
      createdAt: now,
      createdBy: reviewer.id,
      createdByName: reviewer.displayName,
      updatedAt: now,
      patientId: patient.id,
      patientName: patient.fullName,
      patientEmail: patient.email,
      patientNationalId: patient.nationalId,
      patientDateOfBirth: patient.dateOfBirth,
      patientContactNumber: patient.contactNumber,
      employeeId: patient.employeeId,
      position: patient.position,
      route: CASE_ROUTES.DOCTOR,
      status: CASE_STATUSES.SENT_TO_DOCTOR,
      assignedAt: now,
      assignedClinicianId: doctor.id,
      assignedClinicianName: doctor.displayName,
      patientCaseData: demoPatientCaseData(demo, patient)
    });
  }
}

function demoPatientCaseData(demo, patient) {
  return sanitizePatientCaseData({
    personalInfo: {
      firstName: demo.fullName.split(' ')[0],
      lastName: demo.fullName.split(' ').slice(1).join(' '),
      sex: demo.sex,
      maritalStatus: demo.maritalStatus,
      addressLine1: demo.address,
      cityTown: demo.address.includes('Portmore') ? 'Portmore' : 'Kingston',
      parish: demo.address.includes('Portmore') ? 'St. Catherine' : 'Kingston',
      country: 'Jamaica',
      mobilePhone: demo.contactNumber,
      emergencyContactName: demo.emergencyContactName,
      emergencyContactNumber: demo.emergencyContactNumber,
      primaryPhysician: patient.primaryPhysician,
      primaryPhysicianAddress: 'Medical Associates Hospital, Kingston',
      primaryPhysicianPhone: '(876) 555-0200'
    },
    consent: {
      accepted: true,
      signedBy: demo.fullName,
      signedAt: new Date().toISOString()
    },
    familyHistory: {
      relatives: [
        { relationship: 'Mother', age: '58', stateOfHealth: demo.familyNotes, ageAtDeath: '' },
        { relationship: 'Father', age: '61', stateOfHealth: demo.familyNotes, ageAtDeath: '' }
      ],
      disorders: [
        { key: 'highBloodPressure', answer: demo.familyNotes.toLowerCase().includes('hypertension') ? 'yes' : 'no', who: 'Mother' },
        { key: 'diabetes', answer: demo.familyNotes.toLowerCase().includes('diabetes') ? 'yes' : 'no', who: 'Father' },
        { key: 'asthma', answer: demo.familyNotes.toLowerCase().includes('asthma') ? 'yes' : 'no', who: 'Sibling' }
      ],
      notes: demo.familyNotes
    },
    medicalHistory: {
      diseases: demo.diseases,
      questions: demo.questions,
      medications: demo.medicine,
      notes: demo.questions.map((item) => item.detail || item.value).filter(Boolean).join('\n')
    }
  });
}

async function ensureWorkflowDemoCases() {
  const users = await readUsers();
  const doctor = users.find((user) => user.role === ROLES.DOCTOR && user.email === 'doctor@ncb.local') || users.find((user) => user.role === ROLES.DOCTOR);
  const reviewer = users.find((user) => user.role === ROLES.REVIEWER) || users.find((user) => user.role === ROLES.ADMIN) || doctor;
  if (!doctor || !reviewer) return;

  await ensureWorkflowDemoOffice(doctor);

  const now = new Date().toISOString();
  const reviewedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const submittedAt = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const patientSubmittedAt = new Date(Date.now() - 34 * 60 * 60 * 1000).toISOString();
  const cases = await loadAllMedicalCases();
  const candidates = await loadAllCandidates();
  const workflowPatients = workflowDemoDefinitions();

  let usersChanged = false;
  for (const demo of workflowPatients) {
    let patient = candidates.find((candidate) => candidate.id === demo.patientId || candidate.email === demo.email);
    let patientUser = users.find((user) => user.email === demo.email);
    if (!patientUser) {
      patientUser = createUser({
        email: demo.email,
        displayName: demo.fullName,
        role: ROLES.PATIENT,
        password: 'Password123!'
      });
      users.push(patientUser);
      usersChanged = true;
    } else {
      patientUser.displayName = demo.fullName;
      patientUser.role = ROLES.PATIENT;
      patientUser.active = true;
      patientUser.password = makePasswordRecord('Password123!');
      usersChanged = true;
    }

    if (!patient) {
      patient = {
        id: demo.patientId,
        createdAt: now,
        createdBy: reviewer.id,
        createdByName: reviewer.displayName,
        assignedAt: '',
        assignedClinicianId: '',
        assignedClinicianName: '',
        status: 'assigned',
        withdrawalReason: '',
        submittedAt: '',
        submissionId: '',
        fullName: demo.fullName,
        employeeId: demo.employeeId,
        nationalId: demo.nationalId,
        dateOfBirth: demo.dateOfBirth,
        email: demo.email,
        contactNumber: demo.contactNumber,
        address: demo.address,
        emergencyContactName: demo.emergencyContactName,
        emergencyContactNumber: demo.emergencyContactNumber,
        primaryPhysician: demo.primaryPhysician,
        position: demo.position,
        medicationInformation: demo.medicationInformation,
        linkedUserId: patientUser.id,
        linkedUserEmail: patientUser.email
      };
      await saveCandidate(patient);
      candidates.push(patient);
    } else if (!patient.linkedUserId || !patient.linkedUserEmail) {
      patient.linkedUserId = patientUser.id;
      patient.linkedUserEmail = patientUser.email;
      await saveCandidate(patient);
    }

    if (demo.stage === 'profile_only' || cases.some((medicalCase) => medicalCase.id === demo.caseId)) continue;

    const patientCaseData = ['with_patient'].includes(demo.stage) ? sanitizePatientCaseData({}) : workflowPatientCaseData(demo, patient);
    const baseCase = normalizeMedicalCase({
      id: demo.caseId,
      createdAt: now,
      createdBy: reviewer.id,
      createdByName: reviewer.displayName,
      updatedAt: now,
      patientId: patient.id,
      patientName: patient.fullName,
      patientEmail: patient.email,
      patientNationalId: patient.nationalId,
      patientDateOfBirth: patient.dateOfBirth,
      patientContactNumber: patient.contactNumber,
      employeeId: patient.employeeId,
      position: patient.position,
      route: demo.stage === 'with_patient' ? CASE_ROUTES.PATIENT : CASE_ROUTES.DOCTOR,
      status: workflowCaseStatus(demo.stage),
      assignedAt: demo.stage === 'with_patient' ? '' : patientSubmittedAt,
      assignedClinicianId: demo.stage === 'with_patient' ? '' : doctor.id,
      assignedClinicianName: demo.stage === 'with_patient' ? '' : doctor.displayName,
      medicationInformation: patient.medicationInformation,
      patientCaseData,
      paymentStatus: ['with_hr', 'hr_reviewed'].includes(demo.stage) ? 'unpaid' : 'not_payable',
      payableAmount: ['with_hr', 'hr_reviewed'].includes(demo.stage) ? cleanMoney(doctor.medicalProfile?.defaultMedicalFee || 8500) : 0
    });

    if (['with_hr', 'hr_reviewed'].includes(demo.stage)) {
      const submission = workflowDemoSubmission(demo, patient, baseCase, doctor, submittedAt);
      if (demo.stage === 'hr_reviewed') {
        submission.review = {
          status: 'reviewed',
          notes: 'HR review completed. Medical moved to billing as unpaid.',
          reviewedAt,
          reviewedBy: reviewer.id,
          reviewedByName: reviewer.displayName
        };
      }
      await saveSubmission(submission);
      baseCase.submissionId = submission.id;
      baseCase.submittedAt = submittedAt;
      baseCase.doctorDraft = sanitizeDoctorDraft(workflowDoctorPayload(demo, patient, baseCase, doctor, submittedAt));
      if (demo.stage === 'hr_reviewed') {
        baseCase.status = CASE_STATUSES.REVIEWED;
        baseCase.updatedAt = reviewedAt;
      }
    }

    await saveMedicalCase(baseCase);
    cases.push(baseCase);
  }

  if (usersChanged) await writeUsers(users);
}

async function ensureWorkflowDemoOffice(doctor) {
  const offices = await readMedicalOffices();
  const existing = offices.find((office) => office.id === 'office_workflow_demo');
  const assignedClinicianIds = Array.from(new Set([...(existing?.assignedClinicianIds || []), doctor.id]));
  const office = sanitizeMedicalOffice({
    id: 'office_workflow_demo',
    name: 'NCB Demo Medical Centre',
    address: '14 Trafalgar Road, Kingston 5',
    phone: '(876) 555-3300',
    email: 'demo.medical.office@ncb.local',
    defaultMedicalFee: 8500,
    assignedClinicianIds,
    active: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const next = existing ? offices.map((item) => item.id === office.id ? office : item) : [...offices, office];
  await writeMedicalOffices(next);
}

function workflowCaseStatus(stage) {
  return {
    with_patient: CASE_STATUSES.SENT_TO_PATIENT,
    with_doctor: CASE_STATUSES.SENT_TO_DOCTOR,
    with_hr: CASE_STATUSES.DOCTOR_SUBMITTED,
    hr_reviewed: CASE_STATUSES.REVIEWED
  }[stage] || CASE_STATUSES.DRAFT;
}

function workflowDemoDefinitions() {
  return [
    {
      stage: 'profile_only',
      patientId: 'cand_workflow_001',
      fullName: 'Kara Morrison',
      employeeId: 'WF-001',
      nationalId: '100-200-301',
      dateOfBirth: '1996-04-09',
      email: 'workflow.patient1@ncb.local',
      contactNumber: '(876) 555-2101',
      address: '21 Windsor Avenue, Kingston 5',
      emergencyContactName: 'Peter Morrison',
      emergencyContactNumber: '(876) 555-2191',
      primaryPhysician: 'Dr. Latoya Grant',
      position: 'Treasury Assistant',
      sex: 'Female',
      maritalStatus: 'Single',
      medicationInformation: 'No current medication.'
    },
    {
      stage: 'with_patient',
      patientId: 'cand_workflow_002',
      caseId: 'case_workflow_002_with_patient',
      fullName: 'Nicholas Thomas',
      employeeId: 'WF-002',
      nationalId: '100-200-302',
      dateOfBirth: '1991-09-22',
      email: 'workflow.patient2@ncb.local',
      contactNumber: '(876) 555-2102',
      address: '8 West Kings House Road, Kingston 10',
      emergencyContactName: 'Nadine Thomas',
      emergencyContactNumber: '(876) 555-2192',
      primaryPhysician: 'Dr. Owen Clarke',
      position: 'Branch Operations Officer',
      sex: 'Male',
      maritalStatus: 'Married',
      medicationInformation: 'Multivitamin daily.'
    },
    {
      stage: 'with_doctor',
      patientId: 'cand_workflow_003',
      caseId: 'case_workflow_003_with_doctor',
      fullName: 'Simone Walker',
      employeeId: 'WF-003',
      nationalId: '100-200-303',
      dateOfBirth: '1998-01-15',
      email: 'workflow.patient3@ncb.local',
      contactNumber: '(876) 555-2103',
      address: '45 Constant Spring Road, Kingston 8',
      emergencyContactName: 'Janet Walker',
      emergencyContactNumber: '(876) 555-2193',
      primaryPhysician: 'Dr. Marcia Ellis',
      position: 'Digital Support Associate',
      sex: 'Female',
      maritalStatus: 'Single',
      medicationInformation: 'Cetirizine as needed for seasonal allergies.'
    },
    {
      stage: 'with_hr',
      patientId: 'cand_workflow_004',
      caseId: 'case_workflow_004_with_hr',
      fullName: 'Andre Bennett',
      employeeId: 'WF-004',
      nationalId: '100-200-304',
      dateOfBirth: '1988-07-30',
      email: 'workflow.patient4@ncb.local',
      contactNumber: '(876) 555-2104',
      address: '17 Old Hope Road, Kingston 6',
      emergencyContactName: 'Michelle Bennett',
      emergencyContactNumber: '(876) 555-2194',
      primaryPhysician: 'Dr. David Wilson',
      position: 'Relationship Officer',
      sex: 'Male',
      maritalStatus: 'Married',
      medicationInformation: 'No regular medicines.'
    },
    {
      stage: 'hr_reviewed',
      patientId: 'cand_workflow_005',
      caseId: 'case_workflow_005_reviewed',
      fullName: 'Talia Graham',
      employeeId: 'WF-005',
      nationalId: '100-200-305',
      dateOfBirth: '1993-12-04',
      email: 'workflow.patient5@ncb.local',
      contactNumber: '(876) 555-2105',
      address: '3 Waterloo Road, Kingston 10',
      emergencyContactName: 'Grace Graham',
      emergencyContactNumber: '(876) 555-2195',
      primaryPhysician: 'Dr. Renee Johnson',
      position: 'Compliance Analyst',
      sex: 'Female',
      maritalStatus: 'Divorced',
      medicationInformation: 'Salbutamol inhaler as needed.'
    }
  ];
}

function workflowPatientCaseData(demo, patient) {
  const signedAt = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  return sanitizePatientCaseData({
    personalInfo: {
      firstName: demo.fullName.split(' ')[0],
      middleInitial: '',
      lastName: demo.fullName.split(' ').slice(1).join(' '),
      sex: demo.sex,
      maritalStatus: demo.maritalStatus,
      addressLine1: demo.address.split(',')[0],
      addressLine2: '',
      cityTown: demo.address.includes('Kingston') ? 'Kingston' : 'Portmore',
      parish: demo.address.includes('St. Catherine') ? 'St. Catherine' : 'Kingston',
      country: 'Jamaica',
      homePhone: '(876) 555-2200',
      mobilePhone: demo.contactNumber,
      workPhone: '(876) 555-2299',
      emergencyContactName: demo.emergencyContactName,
      emergencyContactNumber: demo.emergencyContactNumber,
      primaryPhysician: demo.primaryPhysician,
      primaryPhysicianAddress: 'Suite 4, Medical Associates, Kingston',
      primaryPhysicianPhone: '(876) 555-2300'
    },
    consent: {
      accepted: true,
      signedBy: demo.fullName,
      signedAt,
      signatureDataUrl: demoSignatureDataUrl(demo.fullName)
    },
    familyHistory: {
      relatives: [
        { relationship: 'Mother', age: '59', stateOfHealth: 'Alive, controlled high blood pressure.', ageAtDeath: '' },
        { relationship: 'Father', age: '63', stateOfHealth: 'Alive, diabetes controlled by diet.', ageAtDeath: '' },
        { relationship: 'Sister', age: '34', stateOfHealth: 'Alive and well.', ageAtDeath: '' },
        { relationship: 'Brother', age: '31', stateOfHealth: 'Alive, asthma in childhood.', ageAtDeath: '' }
      ],
      disorders: [
        { key: 'highBloodPressure', name: 'High Blood Pressure', answer: 'yes', who: 'Mother' },
        { key: 'heartDisease', name: 'Heart Disease', answer: 'no', who: '' },
        { key: 'diabetes', name: 'Diabetes', answer: 'yes', who: 'Father' },
        { key: 'tuberculosis', name: 'Tuberculosis', answer: 'no', who: '' },
        { key: 'asthma', name: 'Asthma', answer: 'yes', who: 'Brother' },
        { key: 'cancer', name: 'Cancer', answer: 'no', who: '' },
        { key: 'epilepsy', name: 'Epilepsy', answer: 'no', who: '' },
        { key: 'mentalDisorders', name: 'Mental Disorders', answer: 'no', who: '' },
        { key: 'paralysis', name: 'Paralysis', answer: 'no', who: '' }
      ],
      notes: 'Family history reviewed with no additional inherited conditions reported.'
    },
    medicalHistory: {
      diseases: workflowDiseaseRows(demo),
      questions: workflowMedicalQuestionRows(demo),
      medications: demo.medicationInformation,
      hospitalizations: 'Hospitalized overnight in 2017 for observation after dehydration.',
      allergies: demo.medicationInformation.toLowerCase().includes('allerg') ? 'Seasonal allergies.' : 'No known drug allergies.',
      chronicConditions: 'No chronic medical condition reported.',
      notes: 'Candidate completed all required medical history questions.'
    }
  });
}

function workflowDiseaseRows(demo) {
  const yesByPatient = {
    'case_workflow_003_with_doctor': new Map([
      ['Hay Fever (Allergic Rhinitis)', '2021'],
      ['Frequent headaches', '2020']
    ]),
    'case_workflow_004_with_hr': new Map([
      ['Back pain', '2019'],
      ['Frequent indigestion', '2022']
    ]),
    'case_workflow_005_reviewed': new Map([
      ['Asthma', '2018'],
      ['Hay Fever (Allergic Rhinitis)', '2020']
    ])
  }[demo.caseId] || new Map();
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
  ].map((name) => ({
    key: medicalHistoryKey(name),
    name,
    answer: yesByPatient.has(name) ? 'yes' : 'no',
    year: yesByPatient.get(name) || ''
  }));
}

function workflowMedicalQuestionRows(demo) {
  return [
    { key: 'currentTreatment', answer: 'no', detail: '' },
    { key: 'hospitalized', answer: 'yes', detail: 'Observed overnight for dehydration at Andrews Memorial Hospital in 2017.' },
    { key: 'workAbsence', answer: 'no', detail: '' },
    { key: 'neurologyPsychiatry', answer: 'no', detail: '' },
    { key: 'regularMedicine', answer: demo.medicationInformation.toLowerCase().includes('no ') ? 'no' : 'yes', detail: demo.medicationInformation },
    { key: 'refusedEmployment', answer: 'no', detail: '' },
    { key: 'smoking', answer: 'no', detail: '', extras: { what: '', years: '0', frequency: '0' } },
    { key: 'alcohol', type: 'text', value: 'Occasional social use, less than two drinks per week.' },
    { key: 'futureTreatment', answer: 'no', detail: '' },
    { key: 'otherHealthInfo', type: 'textarea', value: 'No other significant health information reported.' }
  ];
}

function workflowDoctorPayload(demo, patient, medicalCase, doctor, submittedAt) {
  const profile = doctor.medicalProfile || {};
  return {
    candidate: {
      candidateId: medicalCase.id,
      caseId: medicalCase.id,
      patientId: patient.id,
      fullName: patient.fullName,
      employeeId: patient.employeeId,
      nationalId: patient.nationalId,
      dateOfBirth: patient.dateOfBirth,
      email: patient.email,
      contactNumber: patient.contactNumber,
      position: patient.position,
      medicationInformation: patient.medicationInformation
    },
    assessment: {
      facilityName: profile.facilityName || 'NCB Demo Medical Centre',
      facilityAddress: profile.facilityAddress || '14 Trafalgar Road, Kingston 5',
      assessmentDate: submittedAt.slice(0, 10),
      clinicianName: profile.clinicianName || doctor.displayName,
      clinicianRegistrationNumber: profile.registrationNumber || 'MD-876-DEMO',
      telephoneNumber: '(876) 555-3300',
      faxNumber: '(876) 555-3301',
      emailAddress: doctor.email
    },
    vitals: {
      heightCm: '170',
      weightKg: '72',
      bloodPressure: '118/76',
      pulse: '72',
      vision: '20/20 corrected',
      hearing: 'Normal conversational hearing bilaterally',
      urine: 'Normal dipstick, no glucose or protein detected'
    },
    medicalHistory: {
      cardiac: false,
      respiratory: demo.medicationInformation.toLowerCase().includes('inhaler'),
      diabetes: false,
      hypertension: false,
      allergies: demo.medicationInformation.toLowerCase().includes('allerg'),
      surgeries: false,
      medications: Boolean(demo.medicationInformation && !demo.medicationInformation.toLowerCase().startsWith('no ')),
      mentalHealth: false,
      infectiousDisease: false,
      notes: 'Medical history reviewed with candidate. No findings preventing employment.'
    },
    familyHistory: {
      hypertension: true,
      diabetes: true,
      heartDisease: false,
      asthma: true,
      cancer: false,
      stroke: false,
      kidneyDisease: false,
      mentalHealth: false,
      notes: 'Family history noted. No immediate work restrictions required.'
    },
    physicalExam: workflowPhysicalExam(demo),
    labResults: {
      additionalTests: 'Urinalysis completed. Additional laboratory tests not required at this time.',
      bloodTest: 'CBC within expected range.',
      urineTest: 'Normal.',
      chestXray: 'Not indicated.',
      drugScreen: 'Negative.',
      otherTests: 'None.'
    },
    determination: {
      status: 'fit',
      conclusions: 'Candidate is physically and mentally fit for the duties described.',
      restrictions: 'None.',
      recommendation: 'Cleared Fit For Employment on Medical Grounds.',
      followUpDate: ''
    },
    attestation: {
      signedBy: profile.clinicianName || doctor.displayName,
      signatureDate: submittedAt.slice(0, 10),
      consentConfirmed: true,
      signatureDataUrl: demoSignatureDataUrl(profile.clinicianName || doctor.displayName)
    },
    consent: {
      accepted: true,
      signedBy: patient.fullName,
      signedAt: medicalCase.patientCaseData?.consent?.signedAt || submittedAt,
      signatureDataUrl: medicalCase.patientCaseData?.consent?.signatureDataUrl || ''
    },
    patientCaseData: medicalCase.patientCaseData
  };
}

function workflowDemoSubmission(demo, patient, medicalCase, doctor, submittedAt) {
  const payload = workflowDoctorPayload(demo, patient, medicalCase, doctor, submittedAt);
  const submission = sanitizeSubmission(payload, doctor);
  submission.id = `med_${demo.caseId}`;
  submission.submittedAt = submittedAt;
  submission.caseId = medicalCase.id;
  submission.patientId = patient.id;
  submission.candidate.candidateId = medicalCase.id;
  submission.candidate.caseId = medicalCase.id;
  submission.candidate.patientId = patient.id;
  submission.patientCaseData = medicalCase.patientCaseData;
  submission.familyHistory = medicalCase.patientCaseData.familyHistory;
  submission.consent = medicalCase.patientCaseData.consent;
  return normalizeSubmissionRelationships(submission);
}

function workflowPhysicalExam(demo) {
  return sanitizePhysicianExam({
    generalAppearance: 'Well appearing, alert, oriented and in no acute distress.',
    height: demo.sex === 'Male' ? '178 cm' : '166 cm',
    weight: demo.sex === 'Male' ? '78 kg' : '67 kg',
    nose: 'Normal nasal mucosa.',
    pharynx: 'Clear.',
    teeth: 'Good dental hygiene.',
    tongue: 'Normal.',
    tonsils: 'Not enlarged.',
    thyroid: 'Not enlarged.',
    pulseRate: '72',
    rhythm: 'Regular',
    bloodPressure: '118/76',
    varicoseVeins: 'Absent.',
    presenceOfCyanosis: 'Absent.',
    mucusMembrane: 'Pink and moist.',
    thorax: 'Symmetrical expansion, clear breath sounds.',
    breasts: 'No abnormality reported or detected.',
    fundi: 'Normal.',
    reflexes: 'Normal and symmetrical.',
    sensation: 'Intact.',
    tremors: 'Absent.',
    mentalAppearance: 'Appropriate.',
    behaviour: 'Cooperative.',
    kidneys: 'No renal angle tenderness.',
    organs: 'No abnormality detected.',
    skull: 'Normal.',
    spine: 'Normal alignment, full range of motion.',
    upperExtremities: 'Normal power and range of motion.',
    lowerExtremities: 'Normal gait and range of motion.',
    disabilities: 'No disability identified that would prevent employment.',
    pregnancyTest: demo.sex === 'Female' ? 'Negative' : 'Not applicable'
  });
}

function demoSignatureDataUrl(name) {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABQCAYAAAD7T+K7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAgUlEQVR4nO3RAQ0AAAgDINc/9K3hHBWQ2LszAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAID3A8pSAAGQjXy7AAAAAElFTkSuQmCC';
}

async function readSettings() {
  if (settingsCache) return settingsCache;
  let parsed = {};
  try {
    parsed = hydrateSettingsSecrets(JSON.parse(await fsp.readFile(SETTINGS_PATH, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  settingsCache = sanitizeSettings({ ...defaultSettings, ...parsed });
  return settingsCache;
}

async function writeSettings(settings) {
  settingsCache = sanitizeSettings(settings);
  const persisted = serializeSettingsSecrets(settingsCache);
  await fsp.writeFile(SETTINGS_PATH, `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(SETTINGS_PATH, 0o600);
}

function sanitizeSettings(payload) {
  const settings = payload && typeof payload === 'object' ? payload : {};
  return {
    organizationName: cleanText(settings.organizationName, 160) || defaultSettings.organizationName,
    appName: cleanText(settings.appName, 120) || defaultSettings.appName,
    clinicianIntro: cleanText(settings.clinicianIntro, 500) || defaultSettings.clinicianIntro,
    reviewerIntro: cleanText(settings.reviewerIntro, 500) || defaultSettings.reviewerIntro,
    confidentialityNotice: cleanText(settings.confidentialityNotice, 500) || defaultSettings.confidentialityNotice,
    notificationEmail: cleanEmailList(settings.notificationEmail) || defaultSettings.notificationEmail,
    doctorNotificationEmail: cleanEmailList(settings.doctorNotificationEmail),
    supportContact: cleanText(settings.supportContact, 160) || defaultSettings.supportContact,
    primaryColor: cleanColor(settings.primaryColor, defaultSettings.primaryColor),
    accentColor: cleanColor(settings.accentColor, defaultSettings.accentColor),
    themeColors: sanitizeThemeColors(settings.themeColors),
    smallLogoDataUrl: cleanImageDataUrl(settings.smallLogoDataUrl),
    largeLogoDataUrl: cleanImageDataUrl(settings.largeLogoDataUrl),
    auth: sanitizeAuthSettings(settings.auth),
    mail: sanitizeMailSettings(settings.mail),
    emailTemplates: sanitizeEmailTemplates(settings.emailTemplates),
    operations: sanitizeOperationsSettings(settings.operations),
    database: sanitizeDatabaseSettings(settings.database),
    formTemplate: sanitizeFormTemplate(settings.formTemplate)
  };
}

function publicSettings(settings) {
  return {
    organizationName: settings.organizationName,
    appName: settings.appName,
    clinicianIntro: settings.clinicianIntro,
    reviewerIntro: settings.reviewerIntro,
    confidentialityNotice: settings.confidentialityNotice,
    doctorNotificationEmail: settings.doctorNotificationEmail,
    supportContact: settings.supportContact,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    themeColors: settings.themeColors,
    smallLogoDataUrl: settings.smallLogoDataUrl,
    largeLogoDataUrl: settings.largeLogoDataUrl,
    formTemplate: settings.formTemplate
  };
}

function adminSettings(settings) {
  return {
    ...settings,
    mail: { ...settings.mail, password: settings.mail?.password ? '********' : '' },
    database: {
      ...settings.database,
      password: settings.database?.password ? '********' : '',
      sslKey: settings.database?.sslKey ? '********' : ''
    }
  };
}

function hydrateSettingsSecrets(settings) {
  const hydrated = settings && typeof settings === 'object' ? structuredClone(settings) : {};
  if (hydrated.mail) hydrated.mail.password = decryptStoredSecret(hydrated.mail.password);
  if (hydrated.database) {
    hydrated.database.password = decryptStoredSecret(hydrated.database.password);
    hydrated.database.sslKey = decryptStoredSecret(hydrated.database.sslKey);
  }
  return hydrated;
}

function serializeSettingsSecrets(settings) {
  const persisted = structuredClone(settings);
  if (persisted.mail) persisted.mail.password = encryptStoredSecret(persisted.mail.password);
  if (persisted.database) {
    persisted.database.password = encryptStoredSecret(persisted.database.password);
    persisted.database.sslKey = encryptStoredSecret(persisted.database.sslKey);
  }
  return persisted;
}

function encryptStoredSecret(value) {
  const secret = String(value || '');
  return secret ? { encryptedSecret: encryptJson({ value: secret }) } : '';
}

function decryptStoredSecret(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return cleanText(decryptJson(value.encryptedSecret || {}).value, 20000);
  } catch {
    throw new Error('A saved application secret could not be decrypted. Check APP_MASTER_KEY.');
  }
}

function sanitizeThemeColors(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    background: cleanColor(source.background, defaultSettings.themeColors.background),
    surface: cleanColor(source.surface, defaultSettings.themeColors.surface),
    secondarySurface: cleanColor(source.secondarySurface, defaultSettings.themeColors.secondarySurface),
    text: cleanColor(source.text, defaultSettings.themeColors.text),
    mutedText: cleanColor(source.mutedText, defaultSettings.themeColors.mutedText),
    border: cleanColor(source.border, defaultSettings.themeColors.border),
    primary: cleanColor(source.primary, defaultSettings.themeColors.primary),
    accent: cleanColor(source.accent, defaultSettings.themeColors.accent),
    danger: cleanColor(source.danger, defaultSettings.themeColors.danger)
  };
}

function sanitizeAuthSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    mode: oneOf(source.mode, ['local', 'ldap', 'saml'], 'Authentication mode'),
    ldapEnabled: cleanBool(source.ldapEnabled),
    ldapUrl: cleanText(source.ldapUrl, 300),
    ldapBaseDn: cleanText(source.ldapBaseDn, 300),
    ldapBindDn: cleanText(source.ldapBindDn, 300),
    ldapUserFilter: cleanText(source.ldapUserFilter, 300),
    samlEnabled: cleanBool(source.samlEnabled),
    samlEntryPoint: cleanText(source.samlEntryPoint, 500),
    samlIssuer: cleanText(source.samlIssuer, 300),
    samlCertificate: cleanText(source.samlCertificate, 5000)
  };
}

function sanitizeMailSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: cleanBool(source.enabled),
    host: cleanText(source.host, 260),
    port: clampNumber(source.port, 1, 65535, defaultSettings.mail.port),
    secure: cleanBool(source.secure),
    rejectUnauthorized: source.rejectUnauthorized !== false,
    username: cleanText(source.username, 260),
    password: cleanText(source.password, 500),
    fromEmail: cleanEmailAddressOrBlank(source.fromEmail) || defaultSettings.mail.fromEmail
  };
}

function sanitizeEmailTemplates(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(defaultSettings.emailTemplates).map(([key, fallback]) => {
    const template = source[key] && typeof source[key] === 'object' ? source[key] : {};
    return [key, {
      subject: cleanText(template.subject, 240) || fallback.subject,
      body: cleanText(template.body, 8000) || fallback.body
    }];
  }));
}

function sanitizeOperationsSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    auditRetentionDays: clampNumber(source.auditRetentionDays, 1, 3650, defaultSettings.operations.auditRetentionDays),
    loginWindowMinutes: clampNumber(source.loginWindowMinutes, 1, 120, defaultSettings.operations.loginWindowMinutes),
    loginMaxAttempts: clampNumber(source.loginMaxAttempts, 1, 50, defaultSettings.operations.loginMaxAttempts),
    sessionTimeoutMinutes: clampNumber(source.sessionTimeoutMinutes, 5, 240, defaultSettings.operations.sessionTimeoutMinutes),
    rateLimitPerMinute: clampNumber(source.rateLimitPerMinute, 10, 10000, defaultSettings.operations.rateLimitPerMinute),
    dailyDigestTime: cleanTime(source.dailyDigestTime) || defaultSettings.operations.dailyDigestTime,
    timezone: cleanText(source.timezone, 80) || defaultSettings.operations.timezone
  };
}

function sanitizeDatabaseSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const provider = oneOf(source.provider || 'postgres', ['postgres', 'mysql', 'mariadb', 'cloudsql'], 'Database provider');
  return {
    source: oneOf(source.source || 'environment', ['environment', 'settings'], 'Database configuration source'),
    enabled: cleanBool(source.enabled),
    provider,
    cloudSqlDialect: oneOf(source.cloudSqlDialect || 'postgres', ['postgres', 'mysql'], 'Cloud SQL dialect'),
    host: cleanText(source.host, 260) || '127.0.0.1',
    port: clampNumber(source.port, 1, 65535, provider === 'mysql' || provider === 'mariadb' ? 3306 : 5432),
    database: cleanDatabaseIdentifier(source.database || 'ncb_medical'),
    user: cleanText(source.user, 260),
    password: cleanText(source.password, 2000),
    socketPath: cleanText(source.socketPath, 500),
    sslMode: oneOf(source.sslMode || 'require', ['require', 'no-verify', 'disable'], 'Database SSL mode'),
    sslCa: cleanText(source.sslCa, 20000),
    sslCert: cleanText(source.sslCert, 20000),
    sslKey: cleanText(source.sslKey, 20000),
    autoMigrate: source.autoMigrate !== false,
    autoCreate: cleanBool(source.autoCreate),
    poolMin: clampNumber(source.poolMin, 0, 100, 0),
    poolMax: clampNumber(source.poolMax, 1, 100, 10),
    idleTimeoutMs: clampNumber(source.idleTimeoutMs, 1000, 600000, 30000),
    connectTimeoutMs: clampNumber(source.connectTimeoutMs, 1000, 120000, 10000),
    statementTimeoutMs: clampNumber(source.statementTimeoutMs, 1000, 600000, 30000)
  };
}

function databaseSettingsFromRequest(requested, current = defaultSettings.database) {
  const source = requested && typeof requested === 'object' ? { ...requested } : {};
  if (source.password === '********' || source.password === undefined) source.password = current?.password || '';
  if (source.sslKey === '********' || source.sslKey === undefined) source.sslKey = current?.sslKey || '';
  return sanitizeDatabaseSettings({ ...current, ...source });
}

function effectiveDatabaseConfig(settings) {
  return settings.source === 'environment'
    ? databaseConfig(env)
    : databaseConfigFromSettings(settings, config.appName);
}

function cleanDatabaseIdentifier(value) {
  const identifier = cleanText(value, 63);
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(identifier)) {
    throw new HttpError(400, 'Database name must begin with a letter and contain only letters, numbers, or underscores.');
  }
  return identifier;
}

function defaultFormTemplate() {
  return {
    version: 1,
    updatedAt: '',
    processSteps: defaultProcessSteps(),
    fields: []
  };
}

function defaultProcessSteps() {
  return [
    { id: 'hr_create_medical', label: 'HR creates medical', surface: 'hr', description: 'HR creates a medical case and sends it to the patient or directly to the doctor office.', builtIn: true, active: true },
    { id: 'patient_complete_medical', label: 'Patient completes medical', surface: 'patient', description: 'Patient completes and signs their medical sections before submitting to a doctor office.', builtIn: true, active: true },
    { id: 'doctor_complete_assessment', label: 'Doctor completes assessment', surface: 'doctor', description: 'Doctor completes the physician assessment and submits back to HR.', builtIn: true, active: true },
    { id: 'hr_review_complete', label: 'HR reviews and completes', surface: 'hr', description: 'HR reviews the submitted medical and marks the medical as completed.', builtIn: true, active: true }
  ];
}

function sanitizeFormTemplate(template) {
  const source = template && typeof template === 'object' ? template : defaultFormTemplate();
  const fields = Array.isArray(source.fields) ? source.fields : [];
  return {
    version: Number(source.version || 1),
    updatedAt: new Date().toISOString(),
    processSteps: sanitizeProcessSteps(source.processSteps),
    fields: fields.map(sanitizeFormField).filter(Boolean)
  };
}

function sanitizeProcessSteps(steps) {
  const defaultSteps = defaultProcessSteps();
  const defaults = new Map(defaultSteps.map((step) => [step.id, step]));
  const ordered = [];
  (Array.isArray(steps) ? steps : []).forEach((step) => {
    if (!step || typeof step !== 'object') return;
    const id = cleanText(step.id, 80) || `step_${randomToken(8)}`;
    const sanitized = {
      id,
      builtIn: cleanBool(step.builtIn),
      active: step.active !== false,
      label: cleanText(step.label, 140) || 'Workflow step',
      surface: oneOf(step.surface, ['hr', 'patient', 'doctor'], 'Step form'),
      description: cleanText(step.description, 500)
    };
    defaults.set(id, sanitized);
    ordered.push(sanitized);
  });
  defaultSteps.forEach((step) => {
    if (!ordered.some((item) => item.id === step.id)) ordered.push(defaults.get(step.id));
  });
  return ordered;
}

function sanitizeFormField(field) {
  if (!field || typeof field !== 'object') return null;
  const id = cleanText(field.id, 80) || `field_${randomToken(8)}`;
  const surface = oneOf(field.surface, ['patient', 'doctor', 'hr'], 'Form surface');
  const type = FORM_FIELD_TYPES.includes(field.type) ? field.type : 'text';
  return {
    id,
    builtIn: cleanBool(field.builtIn),
    active: field.active !== false,
    stepId: cleanText(field.stepId, 80),
    surface,
    section: cleanText(field.section, 120) || 'General',
    name: cleanText(field.name, 120) || `customFields.${id}`,
    label: cleanText(field.label, 180) || 'Field',
    type,
    options: Array.isArray(field.options) ? field.options.map((item) => cleanText(item, 120)).filter(Boolean) : [],
    visibleRoles: cleanRoleList(field.visibleRoles),
    editableRoles: cleanRoleList(field.editableRoles),
    requiredRoles: cleanRoleList(field.requiredRoles)
  };
}

function cleanRoleList(value) {
  return (Array.isArray(value) ? value : [])
    .map((role) => cleanText(role, 40))
    .filter((role) => FORM_TEMPLATE_ROLES.includes(role));
}

function cleanCustomFields(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(source)
    .map(([key, val]) => [cleanText(key, 100), typeof val === 'boolean' ? val : cleanText(val, 4000)])
    .filter(([key, val]) => key && val !== ''));
}

function assertTemplateRequiredFields(settings, surface, role, customFields = {}) {
  const fields = settings?.formTemplate?.fields || [];
  fields
    .filter((field) => field.surface === surface && field.active !== false)
    .filter((field) => field.type !== 'information')
    .filter((field) => !field.builtIn && (field.requiredRoles || []).includes(role))
    .forEach((field) => {
      const value = customFields[field.id];
      if (value === undefined || value === null || value === '') {
        throw new HttpError(400, `${field.label || 'Required custom field'} is required.`);
      }
    });
}

function createUser({ email, displayName, role, password, medicalProfile = {} }) {
  return {
    id: `usr_${randomToken(10)}`,
    email,
    displayName,
    role,
    active: true,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    medicalProfile: sanitizeMedicalProfile(medicalProfile),
    password: makePasswordRecord(password)
  };
}

async function readUsers() {
  if (usersCache) return usersCache;
  const parsed = JSON.parse(await fsp.readFile(USERS_PATH, 'utf8'));
  usersCache = parsed.users || [];
  return usersCache;
}

async function writeUsers(users) {
  usersCache = users;
  await fsp.writeFile(USERS_PATH, `${JSON.stringify({ users }, null, 2)}\n`, { mode: 0o600 });
  await safeChmod(USERS_PATH, 0o600);
}

async function mutateUsers(mutator) {
  const operation = usersMutationQueue.then(async () => {
    const users = await readUsers();
    const result = await mutator(users);
    await writeUsers(users);
    return result;
  });
  usersMutationQueue = operation.catch(() => {});
  return operation;
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function assertUniqueUserEmail(users, email, exceptUserId = '') {
  const normalized = normalizeEmail(email);
  if (users.some((user) => user.id !== exceptUserId && normalizeEmail(user.email) === normalized)) {
    throw new HttpError(409, 'A user with that email already exists.');
  }
}

async function revokeOtherUserSessions(userId, keepSessionId = '') {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId === userId && sessionId !== keepSessionId) sessions.delete(sessionId);
  }
}

async function deleteManagedUser(userId, actor) {
  if (actor.role !== ROLES.ADMIN) throw new HttpError(403, 'Only administrators can delete users.');
  if (userId === actor.id) throw new HttpError(400, 'You cannot delete your own account.');

  const users = await readUsers();
  const userIndex = users.findIndex((candidate) => candidate.id === userId);
  if (userIndex === -1) throw new HttpError(404, 'User not found.');
  const [deletedUser] = users.splice(userIndex, 1);

  await writeUsers(users);

  let sessionsRevoked = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId === deletedUser.id) {
      sessions.delete(sessionId);
      sessionsRevoked += 1;
    }
  }

  const cleanup = {
    patientProfilesUnlinked: 0,
    medicalOfficesUpdated: 0,
    activeCasesUnassigned: 0,
    processedCasesPreserved: 0,
    submissionsPreserved: 0,
    sessionsRevoked
  };

  if (deletedUser.role === ROLES.PATIENT) {
    const patients = await loadAllCandidates();
    for (const patient of patients) {
      const isLinkedById = patient.linkedUserId === deletedUser.id;
      const isLinkedByEmail = patient.linkedUserEmail?.toLowerCase() === deletedUser.email;
      if (!isLinkedById && !isLinkedByEmail) continue;
      patient.linkedUserId = '';
      patient.linkedUserEmail = '';
      patient.loginAccessRevokedAt = new Date().toISOString();
      patient.loginAccessRevokedUserId = deletedUser.id;
      await saveCandidate(patient);
      cleanup.patientProfilesUnlinked += 1;
    }
  }

  if (deletedUser.role === ROLES.DOCTOR) {
    const offices = await readMedicalOffices();
    let officesChanged = false;
    for (const office of offices) {
      const before = office.assignedClinicianIds.length;
      office.assignedClinicianIds = office.assignedClinicianIds.filter((id) => id !== deletedUser.id);
      if (office.assignedClinicianIds.length !== before) {
        office.updatedAt = new Date().toISOString();
        officesChanged = true;
        cleanup.medicalOfficesUpdated += 1;
      }
    }
    if (officesChanged) await writeMedicalOffices(offices);

    const cases = await loadAllMedicalCases();
    const processedStatuses = new Set([
      CASE_STATUSES.DOCTOR_SUBMITTED,
      CASE_STATUSES.REVIEW_PENDING,
      CASE_STATUSES.REVIEWED,
      CASE_STATUSES.ARCHIVED
    ]);
    for (const medicalCase of cases) {
      if (medicalCase.assignedClinicianId !== deletedUser.id) continue;
      if (processedStatuses.has(medicalCase.status) || medicalCase.submissionId || medicalCase.submittedAt) {
        cleanup.processedCasesPreserved += 1;
        continue;
      }
      medicalCase.assignedClinicianId = '';
      medicalCase.assignedClinicianName = '';
      medicalCase.assignedAt = '';
      medicalCase.updatedAt = new Date().toISOString();
      await saveMedicalCase(medicalCase);
      cleanup.activeCasesUnassigned += 1;
    }
  }

  if (deletedUser.role === ROLES.DOCTOR) {
    const submissions = await loadAllSubmissions();
    cleanup.submissionsPreserved = submissions.filter((submission) => submission.submittedBy === deletedUser.id).length;
  }

  await appendAudit('managed_user_deleted', {
    userId: actor.id,
    targetUserId: deletedUser.id,
    targetRole: deletedUser.role,
    targetEmailHash: hashForAudit(deletedUser.email),
    cleanup
  });

  return {
    message: `${deletedUser.displayName} was deleted. The email can now be reused.`,
    cleanup
  };
}

async function updateUserEmail(userId, email) {
  const users = await readUsers();
  const normalizedEmail = requiredEmail(email, 'Email');
  const duplicate = users.find((user) => user.id !== userId && user.email === normalizedEmail);
  if (duplicate) throw new HttpError(409, 'A user with that email already exists.');
  const user = users.find((item) => item.id === userId);
  if (!user) throw new HttpError(404, 'User not found.');
  user.email = normalizedEmail;
  await writeUsers(users);
}

function publicAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    active: user.active !== false,
    mustChangePassword: user.mustChangePassword === true,
    createdAt: user.createdAt,
    medicalProfile: sanitizeMedicalProfile(user.medicalProfile || {})
  };
}

function makePasswordRecord(password) {
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return {
    alg: 'PBKDF2-SHA256',
    iterations,
    salt: salt.toString('base64'),
    hash: hash.toString('base64')
  };
}

function verifyPassword(password, record) {
  if (!record || record.alg !== 'PBKDF2-SHA256') return false;
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const actual = crypto.pbkdf2Sync(password, salt, record.iterations, expected.length, 'sha256');
  return crypto.timingSafeEqual(expected, actual);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword === true,
    permissions: permissionsForRole(user.role),
    medicalProfile: sanitizeMedicalProfile(user.medicalProfile || {})
  };
}

function publicSession(session) {
  return {
    timeoutMs: config.sessionTtlMs,
    warningMs: Math.min(config.sessionWarningMs, Math.max(0, config.sessionTtlMs - 1000)),
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(user, permission) {
  return permissionsForRole(user?.role).includes(permission);
}

function requirePermission(user, permission) {
  if (!permission) throw new HttpError(404, 'API route not found.');
  if (!hasPermission(user, permission)) {
    throw new HttpError(403, 'Your account does not have permission to perform this action.');
  }
}

function permissionForApiRequest(method, pathname) {
  if (method === 'GET' && pathname === '/api/me') return PERMISSIONS.AUTH_READ;
  if (method === 'PATCH' && pathname === '/api/me') return PERMISSIONS.AUTH_READ;
  if (method === 'POST' && pathname === '/api/change-password') return PERMISSIONS.AUTH_READ;
  if (method === 'POST' && pathname === '/api/logout') return PERMISSIONS.SESSION_LOGOUT;
  if (method === 'GET' && pathname === '/api/submissions') return PERMISSIONS.SUBMISSIONS_LIST;
  if (method === 'POST' && pathname === '/api/submissions') return PERMISSIONS.SUBMISSIONS_CREATE;
  if (method === 'GET' && pathname === '/api/candidates') return PERMISSIONS.PATIENT_PROFILES_LIST;
  if (method === 'POST' && pathname === '/api/candidates') return PERMISSIONS.PATIENT_PROFILES_CREATE;
  if (/^\/api\/candidates\/[a-zA-Z0-9_-]+\/user$/.test(pathname) && method === 'POST') return PERMISSIONS.PATIENT_PROFILES_UPDATE;
  if (/^\/api\/candidates\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.PATIENT_PROFILES_UPDATE;
  if (method === 'GET' && pathname === '/api/cases') return PERMISSIONS.MEDICAL_CASES_LIST;
  if (method === 'POST' && pathname === '/api/cases') return PERMISSIONS.MEDICAL_CASES_CREATE;
  if (/^\/api\/cases\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'GET') return PERMISSIONS.MEDICAL_CASES_LIST;
  if (/^\/api\/cases\/[a-zA-Z0-9_-]+\/draft$/.test(pathname) && method === 'PUT') return PERMISSIONS.MEDICAL_CASES_UPDATE;
  if (/^\/api\/cases\/[a-zA-Z0-9_-]+\/cancel$/.test(pathname) && method === 'POST') return PERMISSIONS.MEDICAL_CASES_UPDATE;
  if (/^\/api\/cases\/[a-zA-Z0-9_-]+\/attachments$/.test(pathname) && method === 'POST') return PERMISSIONS.MEDICAL_CASES_ATTACH;
  if (/^\/api\/cases\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE;
  if (method === 'GET' && pathname === '/api/setup/clinicians') return PERMISSIONS.DOCTORS_LIST;
  if (method === 'POST' && pathname === '/api/setup/clinicians') return PERMISSIONS.DOCTORS_CREATE;
  if (method === 'GET' && pathname === '/api/setup/reviewers') return PERMISSIONS.REVIEWERS_LIST;
  if (method === 'POST' && pathname === '/api/setup/reviewers') return PERMISSIONS.REVIEWERS_CREATE;
  if (method === 'GET' && pathname === '/api/medical-offices') return PERMISSIONS.DOCTORS_LIST;
  if (method === 'POST' && pathname === '/api/medical-offices') return PERMISSIONS.DOCTORS_CREATE;
  if (/^\/api\/medical-offices\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.DOCTORS_CREATE;
  if (method === 'GET' && pathname === '/api/notification-settings') return PERMISSIONS.NOTIFICATIONS_MANAGE;
  if (method === 'PUT' && pathname === '/api/notification-settings') return PERMISSIONS.NOTIFICATIONS_MANAGE;
  if (method === 'GET' && pathname === '/api/reports/monthly-doctors') return PERMISSIONS.REPORTS_VIEW;
  if (method === 'GET' && pathname === '/api/reports/doctor-cases') return PERMISSIONS.MEDICAL_CASES_LIST;
  if (method === 'GET' && pathname === '/api/reports/management') return PERMISSIONS.REPORTS_VIEW;
  if (method === 'GET' && pathname === '/api/admin/settings') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'PUT' && pathname === '/api/admin/settings') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'POST' && pathname === '/api/admin/mail-test') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'GET' && pathname === '/api/admin/audit') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'GET' && pathname === '/api/admin/database-status') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'POST' && pathname === '/api/admin/database-test') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'PUT' && pathname === '/api/admin/database-config') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'GET' && pathname === '/api/admin/form-template') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'PUT' && pathname === '/api/admin/form-template') return PERMISSIONS.SETTINGS_MANAGE;
  if (method === 'GET' && pathname === '/api/user-management/users') return PERMISSIONS.REVIEWERS_LIST;
  if (method === 'POST' && pathname === '/api/user-management/users') return PERMISSIONS.REVIEWERS_CREATE;
  if (/^\/api\/user-management\/users\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.REVIEWERS_CREATE;
  if (/^\/api\/user-management\/users\/[a-zA-Z0-9_-]+\/password-reset$/.test(pathname) && method === 'POST') return PERMISSIONS.REVIEWERS_CREATE;
  if (/^\/api\/user-management\/users\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'DELETE') return PERMISSIONS.USERS_MANAGE;
  if (method === 'GET' && pathname === '/api/admin/users') return PERMISSIONS.USERS_MANAGE;
  if (method === 'POST' && pathname === '/api/admin/users') return PERMISSIONS.USERS_MANAGE;
  if (/^\/api\/admin\/users\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.USERS_MANAGE;
  if (/^\/api\/admin\/users\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'DELETE') return PERMISSIONS.USERS_MANAGE;
  if (/^\/api\/submissions\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'GET') return PERMISSIONS.SUBMISSIONS_VIEW;
  if (/^\/api\/submissions\/[a-zA-Z0-9_-]+$/.test(pathname) && method === 'PATCH') return PERMISSIONS.SUBMISSIONS_FOLLOW_UP;
  if (/^\/api\/submissions\/[a-zA-Z0-9_-]+\/review$/.test(pathname) && method === 'PATCH') return PERMISSIONS.SUBMISSIONS_REVIEW;
  return '';
}

function cleanRole(value) {
  return oneOf(value, ALL_ROLES, 'Role');
}

function allowedManagedRole(value, user) {
  const role = cleanRole(value);
  if (user.role === ROLES.ADMIN) return role;
  if ([ROLES.DOCTOR, ROLES.REVIEWER, ROLES.PATIENT].includes(role)) return role;
  throw new HttpError(403, 'Only administrators can create or assign administrator users.');
}

function sanitizeManagedUserMedicalProfile(body, role, displayName) {
  const profile = sanitizeMedicalProfile(body.medicalProfile || body);
  if (role === ROLES.DOCTOR) {
    return {
      ...profile,
      clinicianName: profile.clinicianName || displayName
    };
  }
  return profile;
}

async function buildOrLinkPatientProfileForUser(user, profileBody, actor) {
  const patients = await loadAllCandidates();
  const existing = patients.find((patient) => String(patient.email || '').toLowerCase() === user.email);
  if (existing) {
    existing.fullName = existing.fullName || user.displayName;
    existing.linkedUserId = user.id;
    existing.linkedUserEmail = user.email;
    existing.loginAccessRevokedAt = '';
    existing.loginAccessRevokedUserId = '';
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const patient = sanitizeCandidate({
    ...profileBody,
    fullName: user.displayName,
    email: user.email,
    position: profileBody.position,
    dateOfBirth: profileBody.dateOfBirth
  }, actor);
  patient.linkedUserId = user.id;
  patient.linkedUserEmail = user.email;
  patient.loginAccessRevokedAt = '';
  patient.loginAccessRevokedUserId = '';
  patient.updatedAt = new Date().toISOString();
  return patient;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBodyBytes) {
      throw new HttpError(413, 'Request body is too large.');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function sendFile(res, filePath, contentType) {
  if (!filePath.startsWith(PUBLIC_DIR)) {
    throw new HttpError(403, 'Forbidden.');
  }
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

function sendJson(res, status, payload) {
  if (!res.headersSent) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  }
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  if (!res.headersSent) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  }
  res.end(html);
}

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  if (config.cookieSecure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function requiredText(value, label, maxLength) {
  const output = cleanText(value, maxLength);
  if (!output) throw new HttpError(400, `${label} is required.`);
  return output;
}

function requiredEmail(value, label) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email) throw new HttpError(400, `${label} is required.`);
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) && !/^[^@\s<>]+@localhost$/.test(email)) {
    throw new HttpError(400, `${label} must be a valid email address.`);
  }
  return email;
}

function requiredPassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }
  return password;
}

function sanitizeMedicalProfile(profile) {
  const value = profile && typeof profile === 'object' ? profile : {};
  const officeUserType = oneOf(value.officeUserType || value.providerType || 'doctor', MEDICAL_OFFICE_USER_TYPES, 'Medical office user type');
  return {
    facilityName: cleanText(value.facilityName, 180),
    facilityAddress: cleanText(value.facilityAddress, 260),
    clinicianName: cleanText(value.clinicianName, 140),
    officeUserType,
    registrationNumber: cleanText(value.registrationNumber, 100),
    defaultMedicalFee: officeUserType === 'doctor' ? cleanMoney(value.defaultMedicalFee) : 0,
    signatureDataUrl: cleanSignatureDataUrl(value.signatureDataUrl)
  };
}

function normalizeCasePaymentStatus(value, caseStatus) {
  if ([CASE_STATUSES.CANCELED_BY_DOCTOR, CASE_STATUSES.WITHDRAWN].includes(caseStatus)) return 'not_payable';
  return oneOf(value || 'unpaid', ['unpaid', 'paid', 'not_payable'], 'Payment status');
}

function cleanMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\u0000/g, '').trim();
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
}

function cleanSignatureDataUrl(value) {
  const text = cleanText(value, 1500000);
  if (!text) return '';
  if (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(text)) {
    throw new HttpError(400, 'Signature must be a PNG, JPG, or WebP image.');
  }
  return text;
}

function cleanImageDataUrl(value) {
  const text = cleanText(value, 320000);
  if (!text) return '';
  if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/.test(text)) {
    throw new HttpError(400, 'Brand icon must be a PNG, JPG, SVG, or WebP image.');
  }
  return text;
}

function cleanEmailList(value) {
  const emails = cleanText(value, 1000)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) && !/^[^@\s<>]+@localhost$/.test(email)) {
      throw new HttpError(400, 'Notification email list contains an invalid email address.');
    }
  }
  return emails.join(', ');
}

function cleanEmailAddressOrBlank(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email) return '';
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) && !/^[^@\s<>]+@localhost$/.test(email)) {
    throw new HttpError(400, 'Email address must be valid.');
  }
  return email;
}

function uniqueEmails(values) {
  return Array.from(new Set(
    values
      .map((email) => cleanText(email, 254).toLowerCase())
      .filter(Boolean)
  ));
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cleanTime(value) {
  const time = cleanText(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '';
}

function cleanColor(value, fallback) {
  const color = cleanText(value, 20);
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  return fallback;
}

function requiredDate(value, label) {
  const output = cleanOptionalDate(value, label);
  if (!output) throw new HttpError(400, `${label} is required.`);
  return output;
}

function cleanOptionalDate(value, label) {
  const output = cleanText(value, 20);
  if (!output) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(output)) {
    throw new HttpError(400, `${label} must use YYYY-MM-DD format.`);
  }
  return output;
}

function cleanBool(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function oneOf(value, allowed, label) {
  const output = cleanText(value, 80);
  if (!allowed.includes(output)) {
    throw new HttpError(400, `${label} is invalid.`);
  }
  return output;
}

function isRateLimited(key) {
  const item = loginAttempts.get(key);
  if (!item) return false;
  if (item.resetAt < Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return item.count >= 8;
}

function recordFailedLogin(key) {
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    return;
  }
  current.count += 1;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function hashForAudit(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

async function appendAudit(event, details = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...details
  });
  await appendPrivateLine(AUDIT_LOG_PATH, line);
}

async function appendPrivateLine(filePath, line) {
  await fsp.appendFile(filePath, `${line}\n`, { mode: 0o600 });
  await safeChmod(filePath, 0o600);
}

async function readAuditEntries(limit = 250) {
  const text = await fsp.readFile(AUDIT_LOG_PATH, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .reverse()
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { ts: '', event: 'audit_parse_error', raw: line };
      }
    });
}

function renderPrintableSubmission(submission, settings = defaultSettings, options = {}) {
  const patientCaseData = submission.patientCaseData || {};
  const personal = patientCaseData.personalInfo || {};
  const consent = submissionConsent(submission);
  const rows = [
    ['Submission ID', submission.id],
    ['Submitted at', formatDateTime(submission.submittedAt)],
    ['Candidate name', submission.candidate.fullName],
    ['Candidate profile ID', submission.candidate.candidateId],
    ['Employee/applicant ID', submission.candidate.employeeId],
    ['Position', submission.candidate.position],
    ['Date of birth', submission.candidate.dateOfBirth],
    ['Contact number', submission.candidate.contactNumber],
    ['Email', submission.candidate.email],
    ['Sex', personal.sex],
    ['Marital status', personal.maritalStatus],
    ['Address', [personal.addressLine1, personal.addressLine2, personal.cityTown, personal.parish, personal.country].filter(Boolean).join(', ')],
    ['Primary doctor', personal.primaryPhysician],
    ['Primary doctor address', personal.primaryPhysicianAddress],
    ['Primary doctor phone', personal.primaryPhysicianPhone],
    ['Emergency contact', [personal.emergencyContactName, personal.emergencyContactNumber].filter(Boolean).join(' | ')],
    ['Consent accepted', consent.accepted ? 'Yes' : 'No'],
    ['Consent signed by', consent.signedBy],
    ['Consent signed date', consent.signedAt],
    ['Medication information', submission.candidate.medicationInformation],
    ['Medical facility', submission.assessment.facilityName],
    ['Facility address', submission.assessment.facilityAddress],
    ['Assessment date', submission.assessment.assessmentDate],
    ['Clinician', submission.assessment.clinicianName],
    ['Registration number', submission.assessment.clinicianRegistrationNumber],
    ['Height', submission.vitals.heightCm],
    ['Weight', submission.vitals.weightKg],
    ['Blood pressure', submission.vitals.bloodPressure],
    ['Pulse', submission.vitals.pulse],
    ['Vision', submission.vitals.vision],
    ['Hearing', submission.vitals.hearing],
    ['Urine', submission.vitals.urine],
    ['Medical history notes', historySummary(submission.medicalHistory)],
    ['Family history', familyHistorySummary(submission.familyHistory || submission.patientCaseData?.familyHistory || {})],
    ...physicianExamRows(submission),
    ['Laboratory', submission.labResults.additionalTests || submission.labResults.otherTests],
    ['Fitness determination', labelStatus(submission.determination.status)],
    ['Conclusions', submission.determination.conclusions],
    ['Restrictions', submission.determination.restrictions],
    ['Recommendation', submission.determination.recommendation],
    ['Follow-up date', submission.determination.followUpDate],
    ['Attested by', submission.attestation.signedBy],
    ['Signature date', submission.attestation.signatureDate],
    ['Uploaded signature', submission.attestation.signatureDataUrl ? 'Signature image is stored on the secure online record.' : 'Not uploaded'],
    ['Review status', labelStatus(submission.review?.status || 'pending')],
    ['Review notes', submission.review?.notes || '']
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Medical Assessment ${escapeHtml(submission.id)}</title>
  <style>
    body { color: #17202a; font: 14px/1.45 Arial, sans-serif; margin: 32px; }
    header { border-bottom: 3px solid ${escapeHtml(settings.primaryColor)}; margin-bottom: 24px; padding-bottom: 12px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    .classification { color: #5f5000; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cfd8dc; padding: 8px 10px; vertical-align: top; }
    th { background: #eaf3ff; text-align: left; width: 28%; }
    .signature { border: 1px solid #cfd8dc; margin-top: 18px; padding: 12px; }
    .signature img { display: block; max-height: 120px; max-width: 320px; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <header>
    <div class="classification">${escapeHtml(settings.organizationName)} confidential medical assessment</div>
    <h1>${escapeHtml(settings.appName || config.appName)}</h1>
    <div>Generated ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
  </header>
  ${options.showPrintButton === false ? '' : '<button onclick="window.print()">Print</button>'}
  <table>
    <tbody>
      ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || 'Not recorded')}</td></tr>`).join('')}
    </tbody>
  </table>
  ${consent.signatureDataUrl ? `<div class="signature"><strong>Patient signature</strong><img alt="Patient signature" src="${escapeHtml(consent.signatureDataUrl)}"></div>` : ''}
  ${submission.attestation.signatureDataUrl ? `<div class="signature"><strong>Uploaded signature</strong><img alt="Clinician signature" src="${escapeHtml(submission.attestation.signatureDataUrl)}"></div>` : ''}
</body>
</html>`;
}

async function renderSubmissionPdf(submission, settings = defaultSettings) {
  const patientCaseData = submission.patientCaseData || {};
  const personal = patientCaseData.personalInfo || {};
  const consent = submissionConsent(submission);
  const rows = [
    ['Submission ID', submission.id],
    ['Submitted at', formatDateTime(submission.submittedAt)],
    ['Candidate name', submission.candidate.fullName],
    ['Candidate profile ID', submission.candidate.candidateId],
    ['Employee/applicant ID', submission.candidate.employeeId],
    ['National ID/TRN', submission.candidate.nationalId],
    ['Position', submission.candidate.position],
    ['Date of birth', submission.candidate.dateOfBirth],
    ['Contact number', submission.candidate.contactNumber],
    ['Email', submission.candidate.email],
    ['Sex', personal.sex],
    ['Marital status', personal.maritalStatus],
    ['Address', [personal.addressLine1, personal.addressLine2, personal.cityTown, personal.parish, personal.country].filter(Boolean).join(', ')],
    ['Primary doctor', personal.primaryPhysician],
    ['Primary doctor address', personal.primaryPhysicianAddress],
    ['Primary doctor phone', personal.primaryPhysicianPhone],
    ['Emergency contact', [personal.emergencyContactName, personal.emergencyContactNumber].filter(Boolean).join(' | ')],
    ['Consent accepted', consent.accepted ? 'Yes' : 'No'],
    ['Consent signed by', consent.signedBy],
    ['Consent signed date', formatDateTime(consent.signedAt)],
    ['Medical facility', submission.assessment.facilityName],
    ['Facility address', submission.assessment.facilityAddress],
    ['Assessment date', submission.assessment.assessmentDate],
    ['Clinician', submission.assessment.clinicianName],
    ['Registration number', submission.assessment.clinicianRegistrationNumber],
    ['Height', submission.vitals.heightCm],
    ['Weight', submission.vitals.weightKg],
    ['Blood pressure', submission.vitals.bloodPressure],
    ['Pulse', submission.vitals.pulse],
    ['Vision', submission.vitals.vision],
    ['Hearing', submission.vitals.hearing],
    ['Urine', submission.vitals.urine],
    ['Medical history notes', historySummary(submission.medicalHistory)],
    ...physicianExamRows(submission),
    ['Laboratory', submission.labResults.additionalTests || submission.labResults.otherTests],
    ['Fitness determination', labelStatus(submission.determination.status)],
    ['Conclusions', submission.determination.conclusions],
    ['Restrictions', submission.determination.restrictions],
    ['Recommendation', submission.determination.recommendation],
    ['Follow-up date', submission.determination.followUpDate],
    ['Attested by', submission.attestation.signedBy],
    ['Signature date', submission.attestation.signatureDate],
    ['Review status', labelStatus(submission.review?.status || 'pending')],
    ['Review notes', submission.review?.notes || '']
  ];
  return buildMedicalPdf(
    settings.appName || config.appName,
    `${settings.organizationName} medical assessment`,
    rows,
    [
      { label: 'Patient signature', dataUrl: consent.signatureDataUrl },
      { label: 'Doctor signature', dataUrl: submission.attestation?.signatureDataUrl }
    ]
  );
}

async function buildMedicalPdf(title, subtitle, rows, signatures = []) {
  const preparedSignatures = (await Promise.all(signatures.map(async (signature) => ({
    ...signature,
    image: await signatureBuffer(signature.dataUrl)
  })))).filter((signature) => signature.image);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 44, right: 44, bottom: 44, left: 44 },
      info: { Title: `${title} - ${subtitle}`, Author: config.appName }
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(17).fillColor('#17202a').text(title);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor('#4f5b66').text(subtitle);
    doc.text(`Generated ${formatDateTime(new Date().toISOString())}`);
    doc.moveDown(1);

    for (const [label, value] of rows) {
      ensurePdfSpace(doc, 36);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#34495e').text(label);
      doc.font('Helvetica').fontSize(10).fillColor('#17202a').text(String(value || 'Not recorded'), {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right
      });
      doc.moveDown(0.45);
    }

    for (const signature of preparedSignatures) {
      ensurePdfSpace(doc, 150);
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#34495e').text(signature.label);
      const top = doc.y + 6;
      doc.rect(doc.page.margins.left, top, 340, 116).strokeColor('#cfd8dc').lineWidth(0.75).stroke();
      doc.image(signature.image, doc.page.margins.left + 10, top + 10, {
        fit: [320, 96],
        align: 'left',
        valign: 'center'
      });
      doc.y = top + 126;
    }

    doc.end();
  });
}

function ensurePdfSpace(doc, requiredHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > bottom) doc.addPage();
}

async function signatureBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  try {
    const image = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    return match[1].toLowerCase() === 'webp' ? await sharp(image).png().toBuffer() : image;
  } catch {
    return null;
  }
}

function submissionConsent(submission) {
  const stored = submission?.consent || {};
  if (stored.accepted || stored.signedBy || stored.signedAt || stored.signatureDataUrl) return stored;
  return submission?.patientCaseData?.consent || {};
}

function buildSimplePdf(title, rows) {
  const pages = [];
  let lines = wrapPdfText(title, 86);
  for (const [label, value] of rows) {
    lines.push('');
    lines.push(...wrapPdfText(`${label}: ${value || 'Not recorded'}`, 96));
  }
  while (lines.length) pages.push(lines.splice(0, 48));

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  for (const pageLines of pages) {
    const stream = [
      'BT',
      '/F1 11 Tf',
      '50 780 Td',
      '14 TL',
      ...pageLines.map((line, index) => `${index === 0 ? '' : 'T* '}${pdfText(line)} Tj`),
      'ET'
    ].join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  pageIds.forEach((id) => {
    objects[id - 1] = objects[id - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  });
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function wrapPdfText(value, width) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function pdfText(value) {
  return `(${String(value || '').replace(/[\\()]/g, '\\$&')})`;
}

function safeFileName(value) {
  return String(value || 'medical-assessment')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'medical-assessment';
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
  const positives = Object.entries(labels)
    .filter(([key]) => history[key])
    .map(([, label]) => label);
  const summary = positives.length ? positives.join(', ') : 'No selected history items';
  return history.notes ? `${summary}\n\n${history.notes}` : summary;
}

function familyHistorySummary(history) {
  if (Array.isArray(history?.disorders)) {
    const positives = history.disorders
      .filter((item) => item.answer === 'yes' || item.hasCondition === 'yes')
      .map((item) => item.who ? `${item.name} (${item.who})` : item.name)
      .filter(Boolean);
    const summary = positives.length ? positives.join(', ') : 'No selected family history items';
    return history?.notes ? `${summary}\n\n${history.notes}` : summary;
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
  const positives = Object.entries(labels)
    .filter(([key]) => history?.[key])
    .map(([, label]) => label);
  const summary = positives.length ? positives.join(', ') : 'No selected family history items';
  return history?.notes ? `${summary}\n\n${history.notes}` : summary;
}

function physicianExamRows(submission) {
  const exam = submission.physicalExam || {};
  return [
    ['General appearance', exam.generalAppearance || exam.general],
    ['Height', exam.height || submission.vitals?.heightCm],
    ['Weight', exam.weight || submission.vitals?.weightKg],
    ['Nose', exam.nose],
    ['Pharynx', exam.pharynx],
    ['Teeth', exam.teeth],
    ['Tongue', exam.tongue],
    ['Tonsils', exam.tonsils],
    ['Thyroid', exam.thyroid],
    ['Pulse rate', exam.pulseRate || submission.vitals?.pulse],
    ['Rhythm', exam.rhythm],
    ['Blood pressure', exam.bloodPressure || submission.vitals?.bloodPressure],
    ['Varicose veins', exam.varicoseVeins],
    ['Presence of cyanosis', exam.presenceOfCyanosis],
    ['Mucus membrane', exam.mucusMembrane],
    ['Thorax', exam.thorax || exam.respiratory],
    ['Breasts', exam.breasts],
    ['Fundi', exam.fundi || exam.nervousSystem],
    ['Reflexes', exam.reflexes],
    ['Sensation', exam.sensation],
    ['Tremors', exam.tremors],
    ['Mental appearance', exam.mentalAppearance],
    ['Behaviour', exam.behaviour],
    ['Kidneys', exam.kidneys],
    ['Organs', exam.organs],
    ['Skull', exam.skull || exam.musculoskeletal],
    ['Spine', exam.spine],
    ['Upper extremities', exam.upperExtremities],
    ['Lower extremities', exam.lowerExtremities],
    ['Disabilities', exam.disabilities || exam.comments],
    ['Pregnancy test', exam.pregnancyTest]
  ];
}

function labelStatus(value) {
  const labels = {
    fit: 'Fit',
    fit_with_restrictions: 'Fit with restrictions',
    temporarily_deferred: 'Temporarily deferred',
    not_fit: 'Not fit',
    pending: 'Pending review',
    reviewed: 'Reviewed',
    needs_follow_up: 'Needs follow-up',
    archived: 'Archived'
  };
  return labels[value] || value || '';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadMasterKey() {
  if (env.APP_MASTER_KEY) {
    const key = Buffer.from(env.APP_MASTER_KEY, 'base64');
    if (key.length !== 32) {
      throw new Error('APP_MASTER_KEY must be a 32-byte base64 value.');
    }
    return key;
  }

  if (fs.existsSync(MASTER_KEY_PATH)) {
    const key = Buffer.from(fs.readFileSync(MASTER_KEY_PATH, 'utf8').trim(), 'base64');
    if (key.length !== 32) throw new Error('data/master.key is invalid.');
    return key;
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(MASTER_KEY_PATH, `${key.toString('base64')}\n`, { mode: 0o600 });
  safeChmod(MASTER_KEY_PATH, 0o600).catch(() => {});
  console.log(`A local encryption key was generated at ${MASTER_KEY_PATH}`);
  return key;
}

function loadEnv(filePath) {
  const output = { ...process.env };
  if (!fs.existsSync(filePath)) return output;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }
  return output;
}

function ensurePrivateDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dirPath, 0o700);
  } catch {
    // Some filesystems ignore chmod; startup should continue.
  }
}

async function safeChmod(filePath, mode) {
  try {
    await fsp.chmod(filePath, mode);
  } catch {
    // Some filesystems ignore chmod; encryption still protects stored submissions.
  }
}

function stringToBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function parseSessionTimeoutMs(value, fallbackMinutes) {
  const minutes = Number.parseInt(value || String(fallbackMinutes), 10);
  const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 480) : fallbackMinutes;
  return safeMinutes * 60 * 1000;
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function randomReadablePassword() {
  return `${randomToken(9)}-${randomToken(9)}-${randomToken(9)}`;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
