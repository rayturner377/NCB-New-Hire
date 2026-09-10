import { MessagesContainer } from '../../../features/messages/containers/messages-container';

export default function MessagesPage({ searchParams }: { searchParams: { folder?: string; query?: string; page?: string } }) {
  return <MessagesContainer searchParams={searchParams} />;
}
