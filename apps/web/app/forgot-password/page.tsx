import { redirect } from 'next/navigation';
import { AuthLayout } from '../../components/layout/auth-layout';
import { RedeemAccessCodeForm } from '../../features/auth/components/redeem-access-code-form';
import { getPublicSettings } from '../../features/settings/services/settings-service';
import { getSession } from '../../lib/session';

/**
 * Where an account-activation or password-reset code (emailed by
 * createUser/resetUserPassword — see AccessCode's doc comment in
 * schema.prisma) gets redeemed. No self-service "email me a code" entry
 * point here on purpose — a code only ever exists because HR/admin already
 * triggered one elsewhere; this page is just where it's typed in.
 */
export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  const { general } = await getPublicSettings();

  return (
    <AuthLayout logoSrc={general.largeLogoDataUrl || undefined} imageSrc={general.loginImageDataUrl || undefined}>
      <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your email, along with a new password.</p>
      <div className="mt-8">
        <RedeemAccessCodeForm />
      </div>
    </AuthLayout>
  );
}
