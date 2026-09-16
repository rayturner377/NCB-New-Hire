/**
 * The `two-factor` plugin's `otpOptions.sendOTP` callback (see index.ts's
 * `twoFactor()` registration) needs to actually deliver the code by email —
 * but the real implementation (features/notifications' template registry,
 * branding, SMTP settings) lives entirely in apps/web, which this package
 * must never import from: packages/* depend on apps/web, never the reverse,
 * or the workspace's own dependency graph (and packages/auth's independent
 * `tsc` build) breaks.
 *
 * The fix is dependency injection at process startup rather than a direct
 * import: apps/web's own `instrumentation.ts` (Next.js's official
 * once-per-server-start hook) calls `setOtpEmailSender()` with a closure
 * over its own `sendNotification()` before any request — including a real
 * login — can reach this module. `sendOtp()` itself (called from index.ts)
 * just calls whatever was registered; this file has no dependency on
 * index.ts or the constructed `auth` instance, so it's cheap and
 * side-effect-free to import from either side.
 */
export interface OtpEmailRecipient {
  id: string;
  email: string;
  /** Better Auth's `user.name` — mapped to AppUser.displayName (see index.ts's `user.fields`). */
  name?: string | null;
}

export type OtpEmailSender = (recipient: OtpEmailRecipient, otp: string) => Promise<void>;

/**
 * Stashed on `globalThis` rather than a plain module-level variable — confirmed the hard way (real
 * end-to-end testing, instance-ID diagnostic logging) that Next.js loads instrumentation.ts and the
 * API route/server action that actually signs someone in as two SEPARATE evaluations of this module,
 * each with its own module-scope state: `setOtpEmailSender()` called from instrumentation.ts's
 * `register()` was updating a `sender` variable a real sign-in's `sendOtpEmail()` call could never
 * see, so no OTP email was ever sent, in `next dev` or a real production `next start` build.
 * `globalThis` is shared across every module instance in the same Node process regardless of how
 * many separate copies of this module got loaded — the exact same reasoning (and the same fix)
 * packages/database/src/client.ts already uses for its own Prisma singleton.
 */
const globalForOtpSender = globalThis as unknown as { otpEmailSender?: OtpEmailSender };

export function setOtpEmailSender(fn: OtpEmailSender): void {
  globalForOtpSender.otpEmailSender = fn;
}

/** Called by index.ts's `otpOptions.sendOTP` — never throws on its own missing-sender case (logs instead), since a thrown error here would surface to the person signing in as an opaque 500 rather than the real "email isn't wired up" problem. */
export async function sendOtpEmail(recipient: OtpEmailRecipient, otp: string): Promise<void> {
  const sender = globalForOtpSender.otpEmailSender;
  if (!sender) {
    console.error(
      'sendOtpEmail: no sender registered — apps/web/instrumentation.ts must call setOtpEmailSender() before any sign-in can complete. The verification code was NOT sent.'
    );
    return;
  }
  await sender(recipient, otp);
}
