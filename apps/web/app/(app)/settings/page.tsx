import { SettingsContainer } from '../../../features/settings/containers/settings-container';

export default async function SettingsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  return <SettingsContainer searchParams={searchParams} />;
}
