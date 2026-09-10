import { MessagesContainer } from '../../../features/messages/containers/messages-container';

export default async function MessagesPage(
  props: { searchParams: Promise<{ folder?: string; query?: string; page?: string }> }
) {
  const searchParams = await props.searchParams;
  return <MessagesContainer searchParams={searchParams} />;
}
