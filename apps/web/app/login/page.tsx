import { redirect } from 'next/navigation';
import { AuthLayout } from '../../components/layout/auth-layout';
import { Alert } from '../../components/ui/alert';
import { getPublicSettings } from '../../features/settings/services/settings-service';
import { getSession } from '../../lib/session';
import { LoginForm } from '../../features/auth/components/login-form';

export default async function LoginPage(props: { searchParams: Promise<{ reason?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  const { general } = await getPublicSettings();
  const loginImageSrc = general.loginImageMode === 'url' ? general.loginImageUrl : general.loginImageDataUrl;

  return (
    <AuthLayout logoSrc={general.largeLogoDataUrl || undefined} imageSrc={loginImageSrc || undefined}>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in with your NCB Medical Platform account.</p>
      {searchParams.reason === 'idle' ? (
        <div className="mt-4">
          <Alert tone="info">You were signed out after a period of inactivity. Please sign in again.</Alert>
        </div>
      ) : null}
      <div className="mt-8">
        <LoginForm />
      </div>
    </AuthLayout>
  );
}
