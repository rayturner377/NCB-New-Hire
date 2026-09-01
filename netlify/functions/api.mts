import { getStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import crypto from "node:crypto";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: "clinician" | "reviewer" | "admin";
  active: boolean;
  createdAt: string;
  password: PasswordRecord;
  medicalProfile?: MedicalProfile;
};

type PasswordRecord = {
  alg: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  hash: string;
};

type MedicalProfile = {
  facilityName: string;
  facilityAddress: string;
  clinicianName: string;
  registrationNumber: string;
  signatureDataUrl: string;
};

type Candidate = Record<string, any>;
type Submission = Record<string, any>;
type Settings = Record<string, any>;

const defaultSettings = {
  organizationName: "National Commercial Bank Jamaica Limited",
  appName: "National Commercial Bank Jamaica Medical Platform",
  clinicianIntro: "Complete the new-hire medical assessment and submit it directly to National Commercial Bank Jamaica for confidential review.",
  reviewerIntro: "Review submitted new-hire medical assessments, update review status, and print or file authorized forms.",
  confidentialityNotice: "Confidential medical information. Access is restricted to authorized medical facilities and National Commercial Bank Jamaica reviewers.",
  notificationEmail: Netlify.env.get("REVIEW_NOTIFICATION_EMAIL") || "hr-review@ncb.local",
  doctorNotificationEmail: "",
  supportContact: "hr-review@ncb.local",
  primaryColor: "#005baa",
  accentColor: "#ffd200",
  formTemplate: defaultFormTemplate()
};

const FORM_FIELD_TYPES = ["text", "textarea", "date", "number", "email", "phone", "select", "radio", "checkbox", "yes_no", "information"];
const FORM_TEMPLATE_ROLES = ["admin", "hr", "patient", "doctor", "clinician"];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export default async (req: Request, context: Context) => {
  try {
    await ensureUsers();
    await ensureSettings();
    return await route(req);
  } catch (error: any) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error(error);
      await appendAudit("server_error", { message: error.message });
    }
    return json({ error: status >= 500 ? "Unexpected server error." : error.message }, status);
  }
};

export const config: Config = {
  path: ["/api/*", "/submissions/*"]
};

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/public-settings") {
    return json({ settings: publicSettings(await readSettings()) });
  }

  if (req.method === "POST" && pathname === "/api/login") return handleLogin(req);
  if (req.method === "POST" && pathname === "/api/password-reset-request") return handlePasswordResetRequest(req);

  const auth = await requireAuth(req);
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) verifyCsrf(req, auth.session);

  if (req.method === "GET" && pathname === "/api/me") {
    return json({ user: publicUser(auth.user), csrfToken: auth.session.csrfToken, settings: publicSettings(await readSettings()) });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    await appendAudit("logout", { userId: auth.user.id });
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (req.method === "GET" && pathname === "/api/submissions") {
    const submissions = await loadSubmissionsForUser(auth.user);
    return json({ submissions: submissions.map(toSubmissionSummary) });
  }

  if (req.method === "POST" && pathname === "/api/submissions") {
    if (!["clinician", "admin"].includes(auth.user.role)) throw new HttpError(403, "Only clinicians can submit medical assessments.");
    const submission = sanitizeSubmission(await req.json(), auth.user);
    await saveSubmission(submission);
    if (submission.candidate.candidateId) await markCandidateSubmitted(submission.candidate.candidateId, submission.id, auth.user);
    await appendAudit("submission_created", { submissionId: submission.id, userId: auth.user.id, role: auth.user.role });
    const notification = await notifyReviewers(submission);
    return json({ id: submission.id, notification }, 201);
  }

  const submissionMatch = pathname.match(/^\/api\/submissions\/([a-zA-Z0-9_-]+)$/);
  if (submissionMatch && req.method === "GET") {
    const submission = await loadSubmissionById(submissionMatch[1]);
    assertCanViewSubmission(auth.user, submission);
    return json({ submission });
  }

  if (submissionMatch && req.method === "PATCH") {
    const existing = await loadSubmissionById(submissionMatch[1]);
    assertCanEditFollowUp(auth.user, existing);
    const updated = sanitizeSubmission(await req.json(), auth.user);
    const now = new Date().toISOString();
    const submission = {
      ...updated,
      id: existing.id,
      version: Number(existing.version || 1) + 1,
      originalSubmittedAt: existing.originalSubmittedAt || existing.submittedAt,
      submittedAt: now,
      updatedAt: now,
      updateHistory: [
        ...(Array.isArray(existing.updateHistory) ? existing.updateHistory : []),
        { updatedAt: now, updatedBy: auth.user.id, previousReviewStatus: existing.review?.status || "pending", previousReviewNotes: existing.review?.notes || "" }
      ],
      review: { status: "pending", notes: "", reviewedAt: "", reviewedBy: "", reviewedByName: "" }
    };
    await saveSubmission(submission);
    await appendAudit("submission_follow_up_updated", { submissionId: submission.id, userId: auth.user.id });
    const notification = await notifyReviewers(submission);
    return json({ submission, notification });
  }

  const reviewMatch = pathname.match(/^\/api\/submissions\/([a-zA-Z0-9_-]+)\/review$/);
  if (reviewMatch && req.method === "PATCH") {
    requireReviewerOrAdmin(auth.user);
    const body = await req.json();
    const submission = await loadSubmissionById(reviewMatch[1]);
    submission.review = {
      status: oneOf(body.status, ["pending", "reviewed", "needs_follow_up", "archived"], "Review status"),
      notes: cleanText(body.notes, 1500),
      reviewedAt: new Date().toISOString(),
      reviewedBy: auth.user.id,
      reviewedByName: auth.user.displayName
    };
    await saveSubmission(submission);
    await appendAudit("submission_review_updated", { submissionId: submission.id, userId: auth.user.id, reviewStatus: submission.review.status });
    let notification = { status: "skipped", message: "No doctor notification was required for this review status." };
    if (submission.review.status === "needs_follow_up") notification = await notifyDoctorFollowUpRequested(submission);
    else if (submission.review.status === "archived") notification = await notifyDoctorArchived(submission);
    return json({ submission, notification });
  }

  const downloadMatch = pathname.match(/^\/submissions\/([a-zA-Z0-9_-]+)\/download$/);
  if (downloadMatch && req.method === "GET") {
    const submission = await loadSubmissionById(downloadMatch[1]);
    assertCanViewSubmission(auth.user, submission);
    const settings = await readSettings();
    const fileName = `${safeFileName(submission.candidate.fullName || submission.id)}-${submission.id}.pdf`;
    return pdf(renderSubmissionPdf(submission, settings), 200, { "Content-Disposition": `attachment; filename="${fileName}"` });
  }

  if (req.method === "GET" && pathname === "/api/candidates") {
    const candidates = await loadCandidatesForUser(auth.user);
    return json({ candidates: candidates.map(toCandidateSummary) });
  }

  if (req.method === "POST" && pathname === "/api/candidates") {
    requireReviewerOrAdmin(auth.user);
    const candidate = sanitizeCandidate(await req.json(), auth.user);
    await saveCandidate(candidate);
    const notification = await notifyDoctorAssignment(candidate);
    await appendAudit("candidate_created", { candidateId: candidate.id, userId: auth.user.id, assignedClinicianId: candidate.assignedClinicianId });
    return json({ candidate: toCandidateSummary(candidate), notification }, 201);
  }

  const candidateMatch = pathname.match(/^\/api\/candidates\/([a-zA-Z0-9_-]+)$/);
  if (candidateMatch && req.method === "PATCH") {
    const candidate = await loadCandidateById(candidateMatch[1]);
    const body = await req.json();
    const previousClinicianId = candidate.assignedClinicianId;
    if (["reviewer", "admin"].includes(auth.user.role)) updateCandidateFromReviewer(candidate, body);
    else if (auth.user.role === "clinician" && candidate.assignedClinicianId === auth.user.id) updateCandidateFromClinician(candidate, body);
    else throw new HttpError(403, "You are not authorized to update this candidate.");
    await saveCandidate(candidate);
    const notification = candidate.assignedClinicianId && candidate.assignedClinicianId !== previousClinicianId
      ? await notifyDoctorAssignment(candidate)
      : { status: "skipped", message: "No new doctor assignment notification needed." };
    await appendAudit("candidate_updated", { candidateId: candidate.id, userId: auth.user.id, status: candidate.status });
    return json({ candidate: toCandidateSummary(candidate), notification });
  }

  if (req.method === "GET" && pathname === "/api/setup/clinicians") {
    requireReviewerOrAdmin(auth.user);
    const clinicians = (await readUsers()).filter((user) => user.role === "clinician" && user.active !== false).map(publicAdminUser);
    return json({ clinicians: clinicians.sort(sortByName) });
  }

  if (req.method === "POST" && pathname === "/api/setup/clinicians") {
    requireReviewerOrAdmin(auth.user);
    const body = await req.json();
    const user = createUser({
      email: requiredEmail(body.email, "Email"),
      displayName: requiredText(body.displayName, "Display name", 140),
      role: "clinician",
      password: requiredPassword(body.password),
      medicalProfile: sanitizeMedicalProfile(body.medicalProfile || body)
    });
    const users = await readUsers();
    if (users.some((candidate) => candidate.email === user.email)) throw new HttpError(409, "A user with that email already exists.");
    users.push(user);
    await writeUsers(users);
    await appendAudit("clinician_created_by_reviewer", { userId: auth.user.id, clinicianId: user.id });
    return json({ clinician: publicAdminUser(user) }, 201);
  }

  if (req.method === "GET" && pathname === "/api/setup/reviewers") {
    requireReviewerOrAdmin(auth.user);
    const reviewers = (await readUsers()).filter((user) => ["reviewer", "admin"].includes(user.role) && user.active !== false).map(publicAdminUser);
    return json({ reviewers: reviewers.sort(sortByName) });
  }

  if (req.method === "POST" && pathname === "/api/setup/reviewers") {
    requireReviewerOrAdmin(auth.user);
    const body = await req.json();
    const user = createUser({
      email: requiredEmail(body.email, "Email"),
      displayName: requiredText(body.displayName, "Display name", 140),
      role: "reviewer",
      password: requiredPassword(body.password)
    });
    const users = await readUsers();
    if (users.some((candidate) => candidate.email === user.email)) throw new HttpError(409, "A user with that email already exists.");
    users.push(user);
    await writeUsers(users);
    await appendAudit("reviewer_created_by_reviewer", { userId: auth.user.id, reviewerId: user.id });
    return json({ reviewer: publicAdminUser(user) }, 201);
  }

  if (req.method === "GET" && pathname === "/api/reports/monthly-doctors") {
    requireReviewerOrAdmin(auth.user);
    return json({ report: buildMonthlyDoctorReport(await loadAllCandidates(), await loadAllSubmissions(), await readUsers()) });
  }

  if (req.method === "GET" && pathname === "/api/notification-settings") {
    requireReviewerOrAdmin(auth.user);
    const settings = await readSettings();
    return json({ settings: { notificationEmail: settings.notificationEmail, doctorNotificationEmail: settings.doctorNotificationEmail } });
  }

  if (req.method === "PUT" && pathname === "/api/notification-settings") {
    requireReviewerOrAdmin(auth.user);
    const body = await req.json();
    const settings = sanitizeSettings({ ...(await readSettings()), notificationEmail: body.notificationEmail, doctorNotificationEmail: body.doctorNotificationEmail });
    await writeSettings(settings);
    await appendAudit("notification_settings_updated", { userId: auth.user.id });
    return json({ settings: { notificationEmail: settings.notificationEmail, doctorNotificationEmail: settings.doctorNotificationEmail } });
  }

  if (req.method === "GET" && pathname === "/api/admin/settings") {
    requireAdmin(auth.user);
    return json({ settings: await readSettings() });
  }

  if (req.method === "GET" && pathname === "/api/admin/form-template") {
    requireAdmin(auth.user);
    return json({ formTemplate: (await readSettings()).formTemplate });
  }

  if (req.method === "PUT" && pathname === "/api/admin/form-template") {
    requireAdmin(auth.user);
    const body = await req.json();
    const settings = sanitizeSettings({ ...(await readSettings()), formTemplate: body.formTemplate });
    await writeSettings(settings);
    await appendAudit("form_template_updated", { userId: auth.user.id });
    return json({ formTemplate: settings.formTemplate });
  }

  if (req.method === "PUT" && pathname === "/api/admin/settings") {
    requireAdmin(auth.user);
    const settings = sanitizeSettings(await req.json());
    await writeSettings(settings);
    await appendAudit("settings_updated", { userId: auth.user.id });
    return json({ settings });
  }

  if (req.method === "GET" && pathname === "/api/admin/users") {
    requireAdmin(auth.user);
    return json({ users: (await readUsers()).map(publicAdminUser) });
  }

  if (req.method === "POST" && pathname === "/api/admin/users") {
    requireAdmin(auth.user);
    const body = await req.json();
    const user = createUser({
      email: requiredEmail(body.email, "Email"),
      displayName: requiredText(body.displayName, "Display name", 140),
      role: oneOf(body.role, ["clinician", "reviewer", "admin"], "Role") as User["role"],
      password: requiredPassword(body.password),
      medicalProfile: sanitizeMedicalProfile(body.medicalProfile || body)
    });
    const users = await readUsers();
    if (users.some((candidate) => candidate.email === user.email)) throw new HttpError(409, "A user with that email already exists.");
    users.push(user);
    await writeUsers(users);
    return json({ user: publicAdminUser(user) }, 201);
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
  if (adminUserMatch && req.method === "PATCH") {
    requireAdmin(auth.user);
    const body = await req.json();
    const users = await readUsers();
    const user = users.find((candidate) => candidate.id === adminUserMatch[1]);
    if (!user) throw new HttpError(404, "User not found.");
    if (body.email !== undefined) user.email = requiredEmail(body.email, "Email");
    if (body.displayName !== undefined) user.displayName = requiredText(body.displayName, "Display name", 140);
    if (body.role !== undefined) user.role = oneOf(body.role, ["clinician", "reviewer", "admin"], "Role") as User["role"];
    if (body.medicalProfile !== undefined) user.medicalProfile = sanitizeMedicalProfile(body.medicalProfile);
    if (body.active !== undefined) {
      if (user.id === auth.user.id && body.active === false) throw new HttpError(400, "You cannot deactivate your own account.");
      user.active = cleanBool(body.active);
    }
    if (body.password) user.password = makePasswordRecord(requiredPassword(body.password));
    const duplicate = users.find((candidate) => candidate.id !== user.id && candidate.email === user.email);
    if (duplicate) throw new HttpError(409, "A user with that email already exists.");
    await writeUsers(users);
    return json({ user: publicAdminUser(user) });
  }

  throw new HttpError(404, "API route not found.");
}

function store(name: string) {
  return getStore(`ncb-medical-${name}`);
}

async function readObject<T>(storeName: string, key: string, fallback: T): Promise<T> {
  const data = await store(storeName).get(key, { type: "json" });
  return (data as T | null) ?? fallback;
}

async function writeObject(storeName: string, key: string, value: unknown) {
  await store(storeName).setJSON(key, value);
}

async function ensureUsers() {
  const current = await store("users").get("users", { type: "json" });
  if (current) return;
  const adminPassword = Netlify.env.get("INIT_ADMIN_PASSWORD") || "NCBAdmin!2026";
  const reviewerPassword = Netlify.env.get("INIT_REVIEWER_PASSWORD") || "Review123";
  const clinicianPassword = Netlify.env.get("INIT_CLINICIAN_PASSWORD") || "Pa$$word";
  await writeUsers([
    createUser({ email: (Netlify.env.get("INIT_ADMIN_EMAIL") || "admin@ncb.local").toLowerCase(), displayName: "System Administrator", role: "admin", password: adminPassword }),
    createUser({ email: (Netlify.env.get("INIT_REVIEWER_EMAIL") || "hr-review@ncb.local").toLowerCase(), displayName: "HR Reviewer", role: "reviewer", password: reviewerPassword }),
    createUser({ email: (Netlify.env.get("INIT_CLINICIAN_EMAIL") || "doctor@ncb.local").toLowerCase(), displayName: "Medical Clinician", role: "clinician", password: clinicianPassword })
  ]);
}

async function ensureSettings() {
  const current = await store("settings").get("settings", { type: "json" });
  if (!current) await writeSettings(defaultSettings);
}

async function readUsers(): Promise<User[]> {
  return (await readObject<{ users: User[] }>("users", "users", { users: [] })).users;
}

async function writeUsers(users: User[]) {
  await writeObject("users", "users", { users });
}

async function readSettings(): Promise<Settings> {
  return sanitizeSettings(await readObject("settings", "settings", defaultSettings));
}

async function writeSettings(settings: Settings) {
  await writeObject("settings", "settings", sanitizeSettings(settings));
}

async function loadAllEncrypted(storeName: string): Promise<any[]> {
  const { blobs } = await store(storeName).list();
  const output = [];
  for (const blob of blobs) {
    const encrypted = await store(storeName).get(blob.key, { type: "json" });
    if (encrypted) output.push(decryptJson(encrypted));
  }
  return output;
}

async function loadAllCandidates(): Promise<Candidate[]> {
  return (await loadAllEncrypted("candidates")).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function loadCandidateById(id: string): Promise<Candidate> {
  const encrypted = await store("candidates").get(id, { type: "json" });
  if (!encrypted) throw new HttpError(404, "Candidate not found.");
  return decryptJson(encrypted);
}

async function saveCandidate(candidate: Candidate) {
  await store("candidates").setJSON(candidate.id, encryptJson(candidate));
}

async function loadAllSubmissions(): Promise<Submission[]> {
  return (await loadAllEncrypted("submissions")).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

async function loadSubmissionById(id: string): Promise<Submission> {
  const encrypted = await store("submissions").get(id, { type: "json" });
  if (!encrypted) throw new HttpError(404, "Submission not found.");
  return decryptJson(encrypted);
}

async function saveSubmission(submission: Submission) {
  await store("submissions").setJSON(submission.id, encryptJson(submission));
}

async function loadSubmissionsForUser(user: User): Promise<Submission[]> {
  const submissions = await loadAllSubmissions();
  if (["reviewer", "admin"].includes(user.role)) return submissions;
  return submissions.filter((submission) => submission.submittedBy === user.id);
}

async function loadCandidatesForUser(user: User): Promise<Candidate[]> {
  const candidates = await loadAllCandidates();
  if (["reviewer", "admin"].includes(user.role)) return candidates;
  if (user.role === "clinician") return candidates.filter((candidate) => candidate.assignedClinicianId === user.id && candidate.status !== "archived");
  return [];
}

async function handleLogin(req: Request) {
  const body = await req.json();
  const email = cleanText(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const user = (await readUsers()).find((candidate) => candidate.email === email && candidate.active !== false);
  if (!user || !verifyPassword(password, user.password)) {
    await appendAudit("login_failed", { emailHash: hashForAudit(email) });
    throw new HttpError(401, "Invalid email or password.");
  }
  const session = { userId: user.id, csrfToken: randomToken(32), expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
  await appendAudit("login_success", { userId: user.id, role: user.role });
  return json({ user: publicUser(user), csrfToken: session.csrfToken }, 200, { "Set-Cookie": makeSessionCookie(session) });
}

async function handlePasswordResetRequest(req: Request) {
  const body = await req.json();
  const email = cleanText(body.email, 254).toLowerCase();
  await appendNotification({ status: "password_reset_requested", emailHash: hashForAudit(email), notice: "An administrator should verify the requester before resetting this account password." });
  await appendAudit("password_reset_requested", { emailHash: hashForAudit(email) });
  return json({ ok: true, message: "If the email matches an account, an administrator will be able to reset the password." });
}

async function requireAuth(req: Request) {
  const sid = parseCookies(req.headers.get("cookie") || "").sid;
  if (!sid) throw new HttpError(401, "Authentication is required.");
  const [payload, signature] = sid.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) throw new HttpError(401, "Authentication is required.");
  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.expiresAt || session.expiresAt < Date.now()) throw new HttpError(401, "Session expired. Please sign in again.");
  const user = (await readUsers()).find((candidate) => candidate.id === session.userId && candidate.active !== false);
  if (!user) throw new HttpError(401, "User account is not active.");
  return { session, user };
}

function verifyCsrf(req: Request, session: any) {
  const token = req.headers.get("x-csrf-token");
  if (!token || !safeEqual(token, session.csrfToken)) throw new HttpError(403, "Security token is invalid or missing.");
}

function makeSessionCookie(session: any) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return [`sid=${payload}.${sign(payload)}`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=28800", "Secure"].join("; ");
}

function clearSessionCookie() {
  return "sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure";
}

const PHYSICIAN_EXAM_FIELD_KEYS = [
  "generalAppearance",
  "height",
  "weight",
  "nose",
  "pharynx",
  "teeth",
  "tongue",
  "tonsils",
  "thyroid",
  "pulseRate",
  "rhythm",
  "bloodPressure",
  "varicoseVeins",
  "presenceOfCyanosis",
  "mucusMembrane",
  "thorax",
  "breasts",
  "fundi",
  "reflexes",
  "sensation",
  "tremors",
  "mentalAppearance",
  "behaviour",
  "kidneys",
  "organs",
  "skull",
  "spine",
  "upperExtremities",
  "lowerExtremities",
  "disabilities",
  "pregnancyTest"
];

function sanitizeSubmission(payload: any, user: User): Submission {
  const now = new Date().toISOString();
  const candidate = payload.candidate || {};
  const assessment = payload.assessment || {};
  const vitals = payload.vitals || {};
  const history = payload.medicalHistory || {};
  const exam = payload.physicalExam || {};
  const labs = payload.labResults || {};
  const determination = payload.determination || {};
  const attestation = payload.attestation || {};
  const submission = {
    id: `med_${Date.now().toString(36)}_${randomToken(8)}`,
    version: 1,
    status: "submitted",
    submittedAt: now,
    submittedBy: user.id,
    submittedByName: user.displayName,
    submittedByEmail: user.email,
    candidate: {
      candidateId: cleanText(candidate.candidateId, 80),
      fullName: requiredText(candidate.fullName, "Candidate full name", 140),
      employeeId: cleanText(candidate.employeeId, 80),
      nationalId: cleanText(candidate.nationalId, 80),
      dateOfBirth: requiredDate(candidate.dateOfBirth, "Date of birth"),
      email: cleanText(candidate.email, 254),
      contactNumber: cleanText(candidate.contactNumber, 50),
      position: requiredText(candidate.position, "Position applied for", 140)
    },
    assessment: {
      facilityName: requiredText(assessment.facilityName, "Medical facility", 180),
      facilityAddress: cleanText(assessment.facilityAddress, 260),
      assessmentDate: requiredDate(assessment.assessmentDate, "Assessment date"),
      clinicianName: requiredText(assessment.clinicianName, "Clinician name", 140),
      clinicianRegistrationNumber: cleanText(assessment.clinicianRegistrationNumber, 100),
      telephoneNumber: cleanText(assessment.telephoneNumber, 50),
      faxNumber: cleanText(assessment.faxNumber, 50),
      emailAddress: cleanText(assessment.emailAddress, 254)
    },
    vitals: mapClean(vitals, ["heightCm", "weightKg", "bloodPressure", "pulse", "vision", "hearing", "urine"], 180),
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
    physicalExam: mapClean(exam, PHYSICIAN_EXAM_FIELD_KEYS, 2000),
    labResults: mapClean(labs, ["additionalTests", "bloodTest", "urineTest", "chestXray", "drugScreen", "otherTests"], 2000),
    determination: {
      status: oneOf(determination.status, ["fit", "fit_with_restrictions", "temporarily_deferred", "not_fit"], "Fitness determination"),
      conclusions: cleanText(determination.conclusions, 2000),
      restrictions: cleanText(determination.restrictions, 1400),
      recommendation: cleanText(determination.recommendation, 1400),
      followUpDate: cleanOptionalDate(determination.followUpDate, "Follow-up date")
    },
    attestation: {
      signedBy: requiredText(attestation.signedBy, "Clinician attestation name", 140),
      signatureDate: requiredDate(attestation.signatureDate, "Signature date"),
      consentConfirmed: cleanBool(attestation.consentConfirmed),
      signatureDataUrl: cleanSignatureDataUrl(attestation.signatureDataUrl)
    },
    review: { status: "pending", notes: "", reviewedAt: "", reviewedBy: "", reviewedByName: "" }
  };
  if (!submission.attestation.consentConfirmed) throw new HttpError(400, "Consent confirmation is required before submission.");
  return submission;
}

function sanitizeCandidate(payload: any, user: User): Candidate {
  const body = payload && typeof payload === "object" ? payload : {};
  const now = new Date().toISOString();
  return {
    id: `cand_${Date.now().toString(36)}_${randomToken(8)}`,
    createdAt: now,
    createdBy: user.id,
    createdByName: user.displayName,
    assignedAt: now,
    assignedClinicianId: cleanText(body.assignedClinicianId, 80),
    assignedClinicianName: cleanText(body.assignedClinicianName, 140),
    status: "assigned",
    withdrawalReason: "",
    submittedAt: "",
    submissionId: "",
    fullName: requiredText(body.fullName, "Candidate full name", 140),
    employeeId: cleanText(body.employeeId, 80),
    nationalId: cleanText(body.nationalId, 80),
    dateOfBirth: requiredDate(body.dateOfBirth, "Date of birth"),
    email: cleanText(body.email, 254),
    contactNumber: cleanText(body.contactNumber, 50),
    position: requiredText(body.position, "Position applied for", 140)
  };
}

function updateCandidateFromReviewer(candidate: Candidate, body: any) {
  if (body.status !== undefined) candidate.status = oneOf(body.status, ["assigned", "submitted", "withdrawn", "archived"], "Candidate status");
  if (body.assignedClinicianId !== undefined) {
    candidate.assignedClinicianId = cleanText(body.assignedClinicianId, 80);
    candidate.assignedClinicianName = cleanText(body.assignedClinicianName, 140);
    candidate.assignedAt = new Date().toISOString();
  }
}

function updateCandidateFromClinician(candidate: Candidate, body: any) {
  if (body.status !== undefined) candidate.status = oneOf(body.status, ["assigned", "withdrawn"], "Candidate status");
}

async function markCandidateSubmitted(candidateId: string, submissionId: string, user: User) {
  const candidate = await loadCandidateById(candidateId);
  if (candidate.assignedClinicianId && candidate.assignedClinicianId !== user.id && user.role !== "admin") throw new HttpError(403, "This candidate is not assigned to your account.");
  candidate.status = "submitted";
  candidate.submittedAt = new Date().toISOString();
  candidate.submissionId = submissionId;
  await saveCandidate(candidate);
}

async function notifyReviewers(submission: Submission) {
  const settings = await readSettings();
  const recipients = cleanEmailList(settings.notificationEmail || "");
  return sendPlatformEmail({
    recipients: recipients.split(", ").filter(Boolean),
    subject: `${settings.appName || defaultSettings.appName}: medical assessment submitted for review`,
    text: [
      "Hello National Commercial Bank Jamaica reviewer,",
      "",
      "A doctor has submitted a medical assessment in the National Commercial Bank Jamaica Medical Platform.",
      "",
      `Submission ID: ${submission.id}`,
      `Candidate profile ID: ${submission.candidate.candidateId || "Not recorded"}`,
      `Submitted at: ${submission.submittedAt}`,
      "",
      "Please sign in to review and file the submission:",
      publicUrl(),
      "",
      "For confidentiality, no medical details are included in this email."
    ].join("\n"),
    logStatus: "reviewer_submission_notification",
    notification: { submissionId: submission.id, submittedAt: submission.submittedAt, platformUrl: publicUrl(), notice: "A doctor submitted a medical assessment for reviewer action." }
  });
}

async function notifyDoctorAssignment(candidate: Candidate) {
  const users = await readUsers();
  const doctor = users.find((user) => user.id === candidate.assignedClinicianId);
  const settings = await readSettings();
  const recipients = uniqueEmails([doctor?.email || "", ...String(settings.doctorNotificationEmail || "").split(",")]);
  if (!doctor) return { status: "skipped", message: "Assigned doctor account was not found." };
  return sendPlatformEmail({
    recipients,
    subject: `${settings.appName || defaultSettings.appName}: new hire assigned for medical assessment`,
    text: [
      `Hello ${doctor.displayName},`,
      "",
      "A new hire profile has been assigned to you in the National Commercial Bank Jamaica Medical Platform.",
      "",
      `Candidate profile ID: ${candidate.id}`,
      `Employee/applicant ID: ${candidate.employeeId || "Not recorded"}`,
      `Assigned at: ${candidate.assignedAt}`,
      "",
      "Please sign in to complete and submit the medical assessment:",
      publicUrl(),
      "",
      "For confidentiality, no medical details are included in this email."
    ].join("\n"),
    logStatus: "doctor_assignment_notification",
    notification: { candidateId: candidate.id, assignedAt: candidate.assignedAt, platformUrl: publicUrl(), notice: "A new hire profile was assigned for medical assessment." }
  });
}

async function notifyDoctorFollowUpRequested(submission: Submission) {
  const users = await readUsers();
  const doctor = users.find((user) => user.id === submission.submittedBy && user.active !== false);
  const settings = await readSettings();
  if (!doctor) return { status: "skipped", message: "Submitting doctor account was not found." };
  const recipients = uniqueEmails([doctor.email, ...String(settings.doctorNotificationEmail || "").split(",")]);
  return sendPlatformEmail({
    recipients,
    subject: `${settings.appName || defaultSettings.appName}: additional information requested`,
    text: [
      `Hello ${doctor.displayName},`,
      "",
      "A reviewer has requested additional information for a medical assessment in the National Commercial Bank Jamaica Medical Platform.",
      "",
      `Submission ID: ${submission.id}`,
      `Candidate profile ID: ${submission.candidate.candidateId || "Not recorded"}`,
      `Reviewer notes: ${submission.review?.notes || "Please review the secure record for details."}`,
      "",
      "Please sign in, open Submitted records, select the form, and use \"Edit requested form\" to update and resubmit it:",
      publicUrl(),
      "",
      "For confidentiality, no medical findings are included in this email."
    ].join("\n"),
    logStatus: "doctor_follow_up_notification",
    notification: { submissionId: submission.id, reviewStatus: submission.review?.status || "pending", platformUrl: publicUrl(), notice: "A reviewer requested additional information on a medical assessment." }
  });
}

async function notifyDoctorArchived(submission: Submission) {
  const users = await readUsers();
  const doctor = users.find((user) => user.id === submission.submittedBy && user.active !== false);
  const settings = await readSettings();
  if (!doctor) return { status: "skipped", message: "Submitting doctor account was not found." };
  const recipients = uniqueEmails([doctor.email, ...String(settings.doctorNotificationEmail || "").split(",")]);
  return sendPlatformEmail({
    recipients,
    subject: `${settings.appName || defaultSettings.appName}: medical assessment reviewed and archived`,
    text: [
      `Hello ${doctor.displayName},`,
      "",
      "The National Commercial Bank Jamaica reviewer has completed the review and archived the medical assessment.",
      "",
      `Submission ID: ${submission.id}`,
      `Candidate profile ID: ${submission.candidate.candidateId || "Not recorded"}`,
      `Archived at: ${submission.review?.reviewedAt || new Date().toISOString()}`,
      "",
      "No further action is required from you at this time.",
      "",
      "For confidentiality, no medical details are included in this email."
    ].join("\n"),
    logStatus: "doctor_archive_notification",
    notification: { submissionId: submission.id, reviewStatus: submission.review?.status || "archived", platformUrl: publicUrl(), notice: "A reviewer reviewed and archived a medical assessment." }
  });
}

async function sendPlatformEmail({ recipients, subject, text, logStatus, notification }: { recipients: string[]; subject: string; text: string; logStatus: string; notification: Record<string, any> }) {
  const cleanRecipients = uniqueEmails(recipients);
  const resendKey = Netlify.env.get("RESEND_API_KEY") || "";
  const from = Netlify.env.get("RESEND_FROM_EMAIL") || Netlify.env.get("FROM_EMAIL") || "no-reply@ncb-medical-platform.local";
  if (cleanRecipients.length === 0) {
    await appendNotification({ status: `${logStatus}_skipped`, recipients: cleanRecipients, notification });
    return { status: "skipped", message: "No notification recipients are configured." };
  }
  if (!resendKey) {
    await appendNotification({ status: `${logStatus}_logged`, recipients: cleanRecipients, subject, text, notification });
    return { status: "logged", message: "Notification logged. Configure RESEND_API_KEY and RESEND_FROM_EMAIL for live Netlify email delivery." };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: cleanRecipients, subject, text })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    await appendNotification({ status: `${logStatus}_failed`, recipients: cleanRecipients, subject, reason: body, notification });
    return { status: "failed", message: "The record was saved, but email delivery failed. Check the notification log." };
  }
  await appendNotification({ status: `${logStatus}_sent`, recipients: cleanRecipients, subject, notification });
  return { status: "sent", message: "Email notification sent." };
}

async function appendAudit(event: string, details: Record<string, any> = {}) {
  const current = await readObject<any[]>("logs", "audit", []);
  current.push({ ts: new Date().toISOString(), event, ...details });
  await writeObject("logs", "audit", current.slice(-1000));
}

async function appendNotification(details: Record<string, any>) {
  const current = await readObject<any[]>("logs", "notifications", []);
  current.push({ ts: new Date().toISOString(), ...details });
  await writeObject("logs", "notifications", current.slice(-1000));
}

function createUser({ email, displayName, role, password, medicalProfile = {} }: { email: string; displayName: string; role: User["role"]; password: string; medicalProfile?: any }): User {
  return { id: `usr_${randomToken(10)}`, email, displayName, role, active: true, createdAt: new Date().toISOString(), medicalProfile: sanitizeMedicalProfile(medicalProfile), password: makePasswordRecord(password) };
}

function makePasswordRecord(password: string): PasswordRecord {
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return { alg: "PBKDF2-SHA256", iterations, salt: salt.toString("base64"), hash: hash.toString("base64") };
}

function verifyPassword(password: string, record: PasswordRecord) {
  if (!record || record.alg !== "PBKDF2-SHA256") return false;
  const expected = Buffer.from(record.hash, "base64");
  const actual = crypto.pbkdf2Sync(password, Buffer.from(record.salt, "base64"), record.iterations, expected.length, "sha256");
  return crypto.timingSafeEqual(expected, actual);
}

function encryptJson(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return { alg: "AES-256-GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

function decryptJson(record: any) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8"));
}

function masterKey() {
  const raw = Netlify.env.get("APP_MASTER_KEY") || "Dprpz9qhMyu50oh+sAaddKlI1DGDwOlxLxeqCfbxoY4=";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("APP_MASTER_KEY must be a 32-byte base64 value.");
  return key;
}

function sign(value: string) {
  return crypto.createHmac("sha256", masterKey()).update(value).digest("base64url");
}

function sanitizeSettings(settings: any): Settings {
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
    formTemplate: sanitizeFormTemplate(settings.formTemplate)
  };
}

function publicSettings(settings: Settings) {
  const { notificationEmail, ...safe } = settings;
  return safe;
}

function defaultFormTemplate() {
  return {
    version: 1,
    updatedAt: "",
    processSteps: defaultProcessSteps(),
    fields: []
  };
}

function defaultProcessSteps() {
  return [
    { id: "hr_create_medical", label: "HR creates medical", surface: "hr", description: "HR creates a medical case and sends it to the patient or directly to the doctor office.", builtIn: true, active: true },
    { id: "patient_complete_medical", label: "Patient completes medical", surface: "patient", description: "Patient completes and signs their medical sections before submitting to a doctor office.", builtIn: true, active: true },
    { id: "doctor_complete_assessment", label: "Doctor completes assessment", surface: "doctor", description: "Doctor completes the physician assessment and submits back to HR.", builtIn: true, active: true },
    { id: "hr_review_complete", label: "HR reviews and completes", surface: "hr", description: "HR reviews the submitted medical and marks the medical as completed.", builtIn: true, active: true }
  ];
}

function sanitizeFormTemplate(template: any) {
  const source = template && typeof template === "object" ? template : defaultFormTemplate();
  const fields = Array.isArray(source.fields) ? source.fields : [];
  return {
    version: Number(source.version || 1),
    updatedAt: new Date().toISOString(),
    processSteps: sanitizeProcessSteps(source.processSteps),
    fields: fields.map(sanitizeFormField).filter(Boolean)
  };
}

function sanitizeProcessSteps(steps: any) {
  const defaults = new Map(defaultProcessSteps().map((step) => [step.id, step]));
  (Array.isArray(steps) ? steps : []).forEach((step) => {
    if (!step || typeof step !== "object") return;
    const id = cleanText(step.id, 80) || `step_${randomToken(8)}`;
    defaults.set(id, {
      id,
      builtIn: cleanBool(step.builtIn),
      active: step.active !== false,
      label: cleanText(step.label, 140) || "Workflow step",
      surface: oneOf(step.surface, ["hr", "patient", "doctor"], "Step form"),
      description: cleanText(step.description, 500)
    });
  });
  return Array.from(defaults.values());
}

function sanitizeFormField(field: any) {
  if (!field || typeof field !== "object") return null;
  const id = cleanText(field.id, 80) || `field_${randomToken(8)}`;
  const surface = oneOf(field.surface, ["patient", "doctor", "hr"], "Form surface");
  const type = FORM_FIELD_TYPES.includes(field.type) ? field.type : "text";
  return {
    id,
    builtIn: cleanBool(field.builtIn),
    active: field.active !== false,
    stepId: cleanText(field.stepId, 80),
    surface,
    section: cleanText(field.section, 120) || "General",
    name: cleanText(field.name, 120) || `customFields.${id}`,
    label: cleanText(field.label, 180) || "Field",
    type,
    options: Array.isArray(field.options) ? field.options.map((item) => cleanText(item, 120)).filter(Boolean) : [],
    visibleRoles: cleanRoleList(field.visibleRoles),
    editableRoles: cleanRoleList(field.editableRoles),
    requiredRoles: cleanRoleList(field.requiredRoles)
  };
}

function cleanRoleList(value: any) {
  return (Array.isArray(value) ? value : [])
    .map((role) => cleanText(role, 40))
    .filter((role) => FORM_TEMPLATE_ROLES.includes(role));
}

function cleanCustomFields(value: any) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.entries(source)
    .map(([key, val]) => [cleanText(key, 100), typeof val === "boolean" ? val : cleanText(val, 4000)])
    .filter(([key, val]) => key && val !== ""));
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, medicalProfile: sanitizeMedicalProfile(user.medicalProfile || {}) };
}

function publicAdminUser(user: User) {
  return { ...publicUser(user), active: user.active !== false, createdAt: user.createdAt };
}

function toCandidateSummary(candidate: Candidate) {
  return { ...candidate };
}

function toSubmissionSummary(submission: Submission) {
  return { id: submission.id, submittedAt: submission.submittedAt, submittedByName: submission.submittedByName, candidateName: submission.candidate.fullName, employeeId: submission.candidate.employeeId, position: submission.candidate.position, facilityName: submission.assessment.facilityName, clinicianName: submission.assessment.clinicianName, determinationStatus: submission.determination.status, reviewStatus: submission.review?.status || "pending" };
}

function buildMonthlyDoctorReport(candidates: Candidate[], submissions: Submission[], users: User[]) {
  const doctors = new Map(users.filter((user) => user.role === "clinician").map((user) => [user.id, user]));
  const rows = new Map<string, any>();
  for (const candidate of candidates) {
    const month = cleanText(candidate.assignedAt || candidate.createdAt, 30).slice(0, 7) || "unknown";
    const doctorId = candidate.assignedClinicianId || "unassigned";
    const key = `${doctorId}:${month}`;
    const existing = rows.get(key) || { month, doctorId, doctorName: doctors.get(doctorId)?.displayName || candidate.assignedClinicianName || "Unassigned", assignedCount: 0, submittedCount: 0 };
    existing.assignedCount += 1;
    if (candidate.status === "submitted") existing.submittedCount += 1;
    rows.set(key, existing);
  }
  return Array.from(rows.values()).sort((a, b) => b.month.localeCompare(a.month) || a.doctorName.localeCompare(b.doctorName));
}

function renderPrintableSubmission(submission: Submission, settings: Settings) {
  const rows = [
    ["Submission ID", submission.id],
    ["Submitted at", submission.submittedAt],
    ["Candidate name", submission.candidate.fullName],
    ["Employee/applicant ID", submission.candidate.employeeId],
    ["Position", submission.candidate.position],
    ["Date of birth", submission.candidate.dateOfBirth],
    ["Contact number", submission.candidate.contactNumber],
    ["Email", submission.candidate.email],
    ["Medical facility", submission.assessment.facilityName],
    ["Facility address", submission.assessment.facilityAddress],
    ["Assessment date", submission.assessment.assessmentDate],
    ["Clinician", submission.assessment.clinicianName],
    ["Registration number", submission.assessment.clinicianRegistrationNumber],
    ["Fitness determination", submission.determination.status],
    ["Restrictions", submission.determination.restrictions],
    ["Recommendation", submission.determination.recommendation],
    ["Attested by", submission.attestation.signedBy],
    ["Signature date", submission.attestation.signatureDate],
    ["Uploaded signature", submission.attestation.signatureDataUrl ? "Signature image is stored on the secure online record." : "Not uploaded"],
    ["Review status", submission.review?.status || "pending"],
    ["Review notes", submission.review?.notes || ""]
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Medical Assessment ${escapeHtml(submission.id)}</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#17202a}header{border-bottom:3px solid ${escapeHtml(settings.primaryColor)};margin-bottom:20px;padding-bottom:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cfd8dc;padding:8px 10px;vertical-align:top}th{background:#eaf3ff;text-align:left;width:28%}</style></head><body><header><h1>${escapeHtml(settings.appName)}</h1><div>${escapeHtml(settings.organizationName)} medical assessment</div></header><table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "Not recorded")}</td></tr>`).join("")}</tbody></table>${submission.attestation.signatureDataUrl ? `<p><strong>Uploaded signature</strong></p><img alt="Clinician signature" style="max-width:320px;max-height:120px" src="${escapeHtml(submission.attestation.signatureDataUrl)}">` : ""}</body></html>`;
}

function renderSubmissionPdf(submission: Submission, settings: Settings) {
  const rows = [
    ["Submission ID", submission.id],
    ["Submitted at", submission.submittedAt],
    ["Candidate name", submission.candidate.fullName],
    ["Candidate profile ID", submission.candidate.candidateId],
    ["Employee/applicant ID", submission.candidate.employeeId],
    ["National ID/TRN", submission.candidate.nationalId],
    ["Position", submission.candidate.position],
    ["Date of birth", submission.candidate.dateOfBirth],
    ["Contact number", submission.candidate.contactNumber],
    ["Email", submission.candidate.email],
    ["Medical facility", submission.assessment.facilityName],
    ["Facility address", submission.assessment.facilityAddress],
    ["Assessment date", submission.assessment.assessmentDate],
    ["Clinician", submission.assessment.clinicianName],
    ["Registration number", submission.assessment.clinicianRegistrationNumber],
    ["Height", submission.vitals.heightCm],
    ["Weight", submission.vitals.weightKg],
    ["Blood pressure", submission.vitals.bloodPressure],
    ["Pulse", submission.vitals.pulse],
    ["Vision", submission.vitals.vision],
    ["Hearing", submission.vitals.hearing],
    ["Urine", submission.vitals.urine],
    ["Medical history notes", submission.medicalHistory.notes],
    ["General appearance", submission.physicalExam.generalAppearance || submission.physicalExam.general],
    ["Height", submission.physicalExam.height || submission.vitals.heightCm],
    ["Weight", submission.physicalExam.weight || submission.vitals.weightKg],
    ["Nose", submission.physicalExam.nose],
    ["Pharynx", submission.physicalExam.pharynx],
    ["Teeth", submission.physicalExam.teeth],
    ["Tongue", submission.physicalExam.tongue],
    ["Tonsils", submission.physicalExam.tonsils],
    ["Thyroid", submission.physicalExam.thyroid],
    ["Pulse rate", submission.physicalExam.pulseRate || submission.vitals.pulse],
    ["Rhythm", submission.physicalExam.rhythm],
    ["Blood pressure", submission.physicalExam.bloodPressure || submission.vitals.bloodPressure],
    ["Varicose veins", submission.physicalExam.varicoseVeins],
    ["Presence of cyanosis", submission.physicalExam.presenceOfCyanosis],
    ["Mucus membrane", submission.physicalExam.mucusMembrane],
    ["Thorax", submission.physicalExam.thorax || submission.physicalExam.respiratory],
    ["Breasts", submission.physicalExam.breasts],
    ["Fundi", submission.physicalExam.fundi || submission.physicalExam.nervousSystem],
    ["Reflexes", submission.physicalExam.reflexes],
    ["Sensation", submission.physicalExam.sensation],
    ["Tremors", submission.physicalExam.tremors],
    ["Mental appearance", submission.physicalExam.mentalAppearance],
    ["Behaviour", submission.physicalExam.behaviour],
    ["Kidneys", submission.physicalExam.kidneys],
    ["Organs", submission.physicalExam.organs],
    ["Skull", submission.physicalExam.skull || submission.physicalExam.musculoskeletal],
    ["Spine", submission.physicalExam.spine],
    ["Upper extremities", submission.physicalExam.upperExtremities],
    ["Lower extremities", submission.physicalExam.lowerExtremities],
    ["Disabilities", submission.physicalExam.disabilities || submission.physicalExam.comments],
    ["Pregnancy test", submission.physicalExam.pregnancyTest],
    ["Laboratory", submission.labResults.additionalTests || submission.labResults.otherTests],
    ["Fitness determination", submission.determination.status],
    ["Conclusions", submission.determination.conclusions],
    ["Restrictions", submission.determination.restrictions],
    ["Recommendation", submission.determination.recommendation],
    ["Follow-up date", submission.determination.followUpDate],
    ["Attested by", submission.attestation.signedBy],
    ["Signature date", submission.attestation.signatureDate],
    ["Review status", submission.review?.status || "pending"],
    ["Review notes", submission.review?.notes || ""]
  ];
  return buildSimplePdf(`${settings.appName}\n${settings.organizationName} medical assessment`, rows);
}

function buildSimplePdf(title: string, rows: any[][]) {
  const pages: string[][] = [];
  let lines = wrapPdfText(title, 86);
  for (const [label, value] of rows) {
    lines.push("");
    lines.push(...wrapPdfText(`${label}: ${value || "Not recorded"}`, 96));
  }
  while (lines.length) pages.push(lines.splice(0, 48));
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const stream = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL", ...pageLines.map((line, index) => `${index === 0 ? "" : "T* "}${pdfText(line)} Tj`), "ET"].join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pageIds.forEach((id) => {
    objects[id - 1] = objects[id - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  });
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(output, "binary");
}

function wrapPdfText(value: any, width: number) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pdfText(value: any) {
  return `(${String(value || "").replace(/[\\()]/g, "\\$&")})`;
}

function assertCanViewSubmission(user: User, submission: Submission) {
  if (["reviewer", "admin"].includes(user.role)) return;
  if (submission.submittedBy === user.id) return;
  throw new HttpError(403, "You are not authorized to view this submission.");
}

function assertCanEditFollowUp(user: User, submission: Submission) {
  if (!["clinician", "admin"].includes(user.role)) throw new HttpError(403, "Only the doctor can edit a form after review asks for an update.");
  if (user.role !== "admin" && submission.submittedBy !== user.id) throw new HttpError(403, "This form was not submitted by your account.");
  if (submission.review?.status !== "needs_follow_up") throw new HttpError(400, "This form can only be edited after a reviewer marks it as Needs follow-up.");
}

function requireAdmin(user: User) {
  if (user.role !== "admin") throw new HttpError(403, "Only administrators can access this area.");
}

function requireReviewerOrAdmin(user: User) {
  if (!["reviewer", "admin"].includes(user.role)) throw new HttpError(403, "Only reviewers and administrators can access this area.");
}

function sanitizeMedicalProfile(profile: any): MedicalProfile {
  const value = profile && typeof profile === "object" ? profile : {};
  return { facilityName: cleanText(value.facilityName, 180), facilityAddress: cleanText(value.facilityAddress, 260), clinicianName: cleanText(value.clinicianName, 140), registrationNumber: cleanText(value.registrationNumber, 100), signatureDataUrl: cleanSignatureDataUrl(value.signatureDataUrl) };
}

function mapClean(obj: any, keys: string[], max: number) {
  return Object.fromEntries(keys.map((key) => [key, cleanText(obj[key], max)]));
}

function cleanText(value: any, maxLength: number) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\u0000/g, "").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function requiredText(value: any, label: string, maxLength: number) {
  const output = cleanText(value, maxLength);
  if (!output) throw new HttpError(400, `${label} is required.`);
  return output;
}

function requiredEmail(value: any, label: string) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email) throw new HttpError(400, `${label} is required.`);
  if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) && !/^[^@\s<>]+@localhost$/.test(email) && !/^[^@\s<>]+@[^@\s<>]+\.local$/.test(email)) throw new HttpError(400, `${label} must be a valid email address.`);
  return email;
}

function requiredPassword(value: any) {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  return password;
}

function requiredDate(value: any, label: string) {
  const output = cleanOptionalDate(value, label);
  if (!output) throw new HttpError(400, `${label} is required.`);
  return output;
}

function cleanOptionalDate(value: any, label: string) {
  const output = cleanText(value, 20);
  if (!output) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(output)) throw new HttpError(400, `${label} must use YYYY-MM-DD format.`);
  return output;
}

function cleanBool(value: any) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function cleanEmailList(value: any) {
  const emails = cleanText(value, 1000).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) requiredEmail(email, "Notification email");
  return emails.join(", ");
}

function cleanColor(value: any, fallback: string) {
  const color = cleanText(value, 20);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function cleanSignatureDataUrl(value: any) {
  const text = cleanText(value, 1500000);
  if (!text) return "";
  if (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(text)) throw new HttpError(400, "Signature must be a PNG, JPG, or WebP image.");
  return text;
}

function oneOf(value: any, allowed: string[], label: string) {
  const output = cleanText(value, 80);
  if (!allowed.includes(output)) throw new HttpError(400, `${label} is invalid.`);
  return output;
}

function json(payload: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

function html(payload: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(payload, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

function pdf(payload: Buffer, status = 200, headers: Record<string, string> = {}) {
  return new Response(payload, { status, headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", ...headers } });
}

function parseCookies(header: string) {
  return Object.fromEntries(header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function publicUrl() {
  return Netlify.env.get("PUBLIC_URL") || "";
}

function uniqueEmails(values: string[]) {
  return Array.from(new Set(values.map((email) => cleanText(email, 254).toLowerCase()).filter(Boolean)));
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomToken(bytes: number) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashForAudit(value: string) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function safeFileName(value: string) {
  return String(value || "medical-assessment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "medical-assessment";
}

function escapeHtml(value: any) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sortByName(a: any, b: any) {
  return String(a.displayName).localeCompare(String(b.displayName));
}
