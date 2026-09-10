import { SettingsContainer } from '../../../features/settings/containers/settings-container';

export default function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  return <SettingsContainer searchParams={searchParams} />;
}
