/**
 * The integration point for a deployment's own malware scanner — deliberately not bundled with a
 * specific one. Confirmed via external security review that uploaded PDFs were only ever
 * structurally validated (magic-byte checks in case-attachments-service.ts's looksLikePdf), never
 * actually scanned; this is the hook that fixes that, without this app picking a scanner/vendor for
 * every deployment. Which one (if any) is right — a self-hosted engine, an ICAP-speaking gateway
 * many enterprise AV products already expose, a cloud API — depends entirely on what the deploying
 * organization already runs, so that choice belongs to whoever deploys this, not to this codebase.
 *
 * Deliberately safe by default: scanning is OFF unless VIRUS_SCAN_ENABLED=true is explicitly set,
 * and turning it off is never itself a vulnerability — case-attachments-service.ts's
 * uploadCaseAttachment and the attachment route's own scanStatus gating both treat "scanning isn't
 * configured" as "behave exactly as this app did before this feature existed" (normal case-access
 * rules, no extra restriction), not as a permanently-blocked or falsely-"clean" state. Only once
 * scanning is genuinely active does a file sitting at 'pending' mean "wait for the real verdict,
 * uploader-only in the meantime" — see the route's own doc comment.
 */

export type ScanVerdict = 'clean' | 'infected' | 'unavailable';

export interface ScanResult {
  verdict: ScanVerdict;
  /** Free-form detail from the real scanner (e.g. which signature matched) — for troubleshooting only, never shown to an ordinary user. */
  detail?: string;
}

/**
 * Whether a real scanner is wired in at all. Checked separately from a single call's own
 * success/failure so callers can tell "scanning isn't configured, so a 'pending' status just means
 * 'never scanned' and normal access applies" from "scanning IS configured, so a real clean/infected
 * verdict should land within seconds." Flip this on only once scanBuffer() below has a real
 * implementation — leaving it true with no implementation makes every scan attempt throw (caught
 * and logged by the caller, not a crash) rather than silently pretending to scan.
 */
export function isScanningEnabled(): boolean {
  return process.env.VIRUS_SCAN_ENABLED === 'true';
}

/**
 * Replace this body with a real call to your organization's scanner once you have one — an
 * HTTP/TCP request to a self-hosted engine, an ICAP RESPMOD request to an enterprise AV gateway,
 * a cloud scanning API, whatever fits. Nothing else in this app needs to change: return `clean` for
 * a verified-safe file, `infected` for a real detection, and `unavailable` for anything else (the
 * scanner being unreachable, timing out, erroring) — never let `unavailable` fall through to
 * `clean` just because a request failed, since that would be exactly the false assurance this
 * feature exists to prevent. Never throw for an ordinary scan-came-back-dirty result; only let this
 * throw for a genuine implementation bug, since the caller logs but does not otherwise act on a
 * thrown error here (see case-attachments-service.ts's scanAttachmentInBackground).
 */
export async function scanBuffer(data: Buffer): Promise<ScanResult> {
  void data;
  if (!isScanningEnabled()) {
    return { verdict: 'unavailable' };
  }
  throw new Error(
    'VIRUS_SCAN_ENABLED is true, but scanBuffer() in lib/virus-scan.ts has no real scanner implementation wired in yet.'
  );
}
