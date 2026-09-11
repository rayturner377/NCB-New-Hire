import { MessageDetailContainer } from '../../../../features/messages/containers/message-detail-container';

export default async function MessageDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <MessageDetailContainer messageId={params.id} />;
}
