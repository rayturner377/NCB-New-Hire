import { AuthLayout } from '../../components/layout/auth-layout';
import { getPublicSettings } from '../../features/settings/services/settings-service';
import { VerifyDeviceForm } from '../../features/auth/components/verify-device-form';

/**
 * Reached only via login.ts's redirect() when signInEmail returns
 * `twoFactorRedirect: true` (an unrecognized device/browser) — deliberately
 * doesn't check getSession() the way /login does, since there is no app
 * session yet at this point by design (see verify-device-code.ts's own doc
 * comment): the plugin's `after` hook already deleted the one signInEmail
 * briefly created.
 */
export default async function VerifyDevicePage() {
  const { general } = await getPublicSettings();
  const loginImageSrc = general.loginImageMode === 'url' ? general.loginImageUrl : general.loginImageDataUrl;

  return (
    <AuthLayout logoSrc={general.largeLogoDataUrl || undefined} imageSrc={loginImageSrc || undefined}>
      <h1 className="text-2xl font-semibold tracking-tight">Verify it&apos;s you</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We don&apos;t recognize this device. Enter the code we emailed you to finish signing in.
      </p>
      <div className="mt-8">
        <VerifyDeviceForm />
      </div>
    </AuthLayout>
  );
}
