import { redirect } from 'next/navigation';
import { AuthLayout } from '../../components/layout/auth-layout';
import { ChangePasswordForm } from '../../features/auth/components/change-password-form';
import { getPublicSettings } from '../../features/settings/services/settings-service';
import { getSession } from '../../lib/session';

/**
 * Outside the (app) route group (a sibling of /login, no Sidebar/Topbar) so
 * that AuthenticatedLayout's own mustChangePassword redirect (see
 * app/(app)/layout.tsx) has somewhere to send the user that isn't itself
 * gated the same way — otherwise it'd redirect to itself in a loop.
 */
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!session.user.mustChangePassword) {
    redirect('/');
  }

  const { general } = await getPublicSettings();

  return (
    <AuthLayout logoSrc={general.largeLogoDataUrl || undefined}>
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        For your security, choose your own password before continuing — the temporary one you signed in with can&apos;t be reused.
      </p>
      <div className="mt-8">
        <ChangePasswordForm />
      </div>
    </AuthLayout>
  );
}
