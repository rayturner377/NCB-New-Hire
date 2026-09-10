import { BarChart3, Building2, Stethoscope, UserCog } from 'lucide-react';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { ShortcutCard } from '../../../../components/dashboard/shortcut-card';

/** Ported from server.js's admin nav (public/app.js ~L1020-1027) — Report Management isn't built yet; Medical Offices and Doctor Management now point at the real Doctors workspace (see DoctorsWorkspaceContainer). */
export function AdminShortcutsGrid() {
  return (
    <SectionCard title="Administration">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ShortcutCard label="Users" icon={UserCog} href="/users" />
        <ShortcutCard label="Medical Offices" icon={Building2} href="/doctors?tab=offices" />
        <ShortcutCard label="Doctor Management" icon={Stethoscope} href="/doctors" />
        <ShortcutCard label="Report Management" icon={BarChart3} href="#" disabled />
      </div>
    </SectionCard>
  );
}
