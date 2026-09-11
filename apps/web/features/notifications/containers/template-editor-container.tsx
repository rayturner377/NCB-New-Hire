import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getSettings } from '../../settings/services/settings-service';
import { TemplateEditorPage } from '../components/template-editor-page';
import { substituteBodyVariables } from '../template-rendering';
import { getTemplateView } from '../services/templates-service';

export interface TemplateEditorContainerProps {
  templateKey: string;
}

/** Sample values matching template-editor-page.tsx's own SAMPLE_VARIABLE_VALUES, just for the common tokens the shared header/footer ever use. */
function commonSampleValues(portalName: string, organizationName: string, logoUrl?: string): Record<string, string> {
  return { portalName, organizationName, logoUrl: logoUrl ?? '' };
}

export async function TemplateEditorContainer({ templateKey }: TemplateEditorContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS_MANAGE)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.SETTINGS_MANAGE,
      path: `/settings/templates/${templateKey}`
    });
    redirect('/');
  }

  const [template, settings] = await Promise.all([getTemplateView(templateKey), getSettings()]);
  if (!template) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Unknown notification type.</p>
      </div>
    );
  }

  const branding = {
    portalName: settings.general.portalName,
    organizationName: settings.general.organizationName,
    logoUrl: settings.general.smallLogoDataUrl || undefined
  };
  const sampleValues = commonSampleValues(branding.portalName, branding.organizationName, branding.logoUrl);

  // The preview needs BOTH shared pieces regardless of which one is being edited (or neither, when
  // editing an ordinary notification's own body) — fetch whichever the page itself isn't already
  // editing, already substituted with sample values so template-editor-page.tsx can drop it straight
  // into the preview without knowing anything about where it came from.
  const needsHeader = templateKey !== 'email_header';
  const needsFooter = templateKey !== 'email_footer';
  const [headerTemplate, footerTemplate] = await Promise.all([
    needsHeader ? getTemplateView('email_header') : Promise.resolve(null),
    needsFooter ? getTemplateView('email_footer') : Promise.resolve(null)
  ]);

  return (
    <div className="p-6">
      <TemplateEditorPage
        template={template}
        branding={branding}
        otherHeaderHtml={headerTemplate ? substituteBodyVariables(headerTemplate.body, sampleValues) : undefined}
        otherFooterHtml={footerTemplate ? substituteBodyVariables(footerTemplate.body, sampleValues) : undefined}
        otherFooterBackgroundColor={footerTemplate?.backgroundColor || undefined}
      />
    </div>
  );
}
