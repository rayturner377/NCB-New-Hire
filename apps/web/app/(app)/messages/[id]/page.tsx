import { MessageDetailContainer } from '../../../../features/messages/containers/message-detail-container';

export default function MessageDetailPage({ params }: { params: { id: string } }) {
  return <MessageDetailContainer messageId={params.id} />;
}
