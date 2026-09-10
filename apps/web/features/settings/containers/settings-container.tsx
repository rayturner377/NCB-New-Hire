import { redirect } from 'next/navigation';
import { rolePermissionsRepository } from '@ncb/database';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, ROLES, hasPermission, permissionCatalog } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { ExportSettingsForm } from '../components/export-settings-form';
import { GeneralSettingsForm } from '../components/general-settings-form';
import { MailSettingsForm } from '../components/mail-settings-form';
import { NotificationSettingsForm } from '../components/notification-settings-form';
import { PermissionsMatrix } from '../components/permissions-matrix';
import { SlaSettingsForm } from '../components/sla-settings-form';
import { ThemeSettingsForm } from '../components/theme-settings-form';
import { UserPolicySettingsForm } from '../components/user-policy-settings-form';
import { TemplatesSettingsList } from '../../notifications/components/templates-settings-list';
import { listStructuralTemplateViews, listTemplateViews } from '../../notifications/services/templates-service';
import { getSettings } from '../services/settings-service';

const TAB_KEYS = ['general', 'notifications', 'templates', 'export', 'users', 'sla', 'theme', 'mail', 'permissions'] as const;

const EDITABLE_ROLES: { role: string; label: string }[] = [
  { role: ROLES.REVIEWER, label: 'Reviewer' },
  { role: ROLES.AUDITOR, label: 'Auditor' },
  { role: ROLES.DOCTOR, label: 'Doctor' },
  { role: ROLES.PATIENT, label: 'Patient' }
];


export interface SettingsContainerProps {
  searchParams?: { tab?: string };
}

/** Admin-only system settings console at /settings — see lib/permissions.ts's PERMISSIONS.SETTINGS_MANAGE (admin holds every permission; nobody else holds this one). Each tab is an independent form/section of the same stored settings object (see settings-service.ts). `?tab=` only sets which tab is selected on first render (Radix's Tabs stays uncontrolled after that, same as every other click) — it exists so the template editor's "Back to templates" link can land back on the Templates tab specifically, not always General. */
export async function SettingsContainer({ searchParams = {} }: SettingsContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS_MANAGE)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.SETTINGS_MANAGE,
      path: '/settings'
    });
    redirect('/');
  }

  const canManageRoles = hasPermission(session.user, PERMISSIONS.ROLES_MANAGE);
  const [settings, templates, structuralTemplates, rolePermissionRows] = await Promise.all([
    getSettings(),
    listTemplateViews(),
    listStructuralTemplateViews(),
    canManageRoles ? rolePermissionsRepository.listAll() : Promise.resolve([])
  ]);
  const initialTab = (TAB_KEYS as readonly string[]).includes(searchParams.tab ?? '') ? searchParams.tab! : 'general';

  const permissionsByRole = new Map<string, string[]>();
  for (const row of rolePermissionRows) {
    const list = permissionsByRole.get(row.role) ?? [];
    list.push(row.permission);
    permissionsByRole.set(row.role, list);
  }
  const allPermissions = permissionCatalog();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Portal identity, notifications, SLA targets, theme, and mail configuration.</p>
      </div>

      <Tabs defaultValue={initialTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="users">User policy</TabsTrigger>
            <TabsTrigger value="sla">SLA</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="mail">Mail</TabsTrigger>
            {canManageRoles ? <TabsTrigger value="permissions">Permissions</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="general" className="rounded-md border p-4">
          <GeneralSettingsForm settings={settings.general} />
        </TabsContent>
        <TabsContent value="notifications" className="rounded-md border p-4">
          <NotificationSettingsForm settings={settings.notifications} mailEnabled={settings.mail.enabled} />
        </TabsContent>
        <TabsContent value="templates" className="flex flex-col gap-6 rounded-md border p-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Header &amp; footer</h2>
            <TemplatesSettingsList
              templates={structuralTemplates}
              description="Shared by every outgoing email — full HTML and inline CSS, same as any other template below."
            />
          </div>
          <div className="flex flex-col gap-2 border-t pt-6">
            <h2 className="text-sm font-semibold">Notification types</h2>
            <TemplatesSettingsList templates={templates} />
          </div>
        </TabsContent>
        <TabsContent value="export" className="rounded-md border p-4">
          <ExportSettingsForm settings={settings.export} />
        </TabsContent>
        <TabsContent value="users" className="rounded-md border p-4">
          <UserPolicySettingsForm settings={settings.userPolicy} />
        </TabsContent>
        <TabsContent value="sla" className="rounded-md border p-4">
          <SlaSettingsForm definitions={settings.sla.definitions} />
        </TabsContent>
        <TabsContent value="theme" className="rounded-md border p-4">
          <ThemeSettingsForm settings={settings.theme} />
        </TabsContent>
        <TabsContent value="mail" className="rounded-md border p-4">
          <MailSettingsForm settings={settings.mail} />
        </TabsContent>
        {canManageRoles ? (
          <TabsContent value="permissions" className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              What each role can do — changes save automatically a moment after you toggle a box. Admin isn&apos;t listed here: it always
              holds every permission, so it can never be edited into locking every admin out. Hover a permission&apos;s name for what it
              actually does.
            </p>
            <PermissionsMatrix
              roles={EDITABLE_ROLES}
              permissions={allPermissions}
              initialPermissionsByRole={Object.fromEntries(permissionsByRole)}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
