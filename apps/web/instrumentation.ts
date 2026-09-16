/**
 * Next.js's official once-per-server-start hook (auto-detected, no config
 * needed as of Next 15+ — this app is on 16). Its one job here: wire up
 * @ncb/auth's new-device OTP email so it actually goes out through this
 * app's own branded template system (features/notifications) — see
 * packages/auth/src/otp-email.ts's own doc comment for why that can't just
 * be a direct import from packages/auth (packages/* must never depend on
 * apps/web, or the workspace's dependency graph, and packages/auth's own
 * independent build, breaks). This runs before any request — including a
 * real sign-in — can reach the two-factor plugin's sendOTP callback.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { setOtpEmailSender } = await import('@ncb/auth/otp-email');
  const { sendNotification } = await import('./features/notifications/services/notification-service');

  setOtpEmailSender(async (recipient, otp) => {
    await sendNotification({
      templateKey: 'device_verification_code',
      to: recipient.email,
      variables: { recipientName: recipient.name || recipient.email, otp },
      entityType: 'user',
      entityId: recipient.id
    });
  });
}
