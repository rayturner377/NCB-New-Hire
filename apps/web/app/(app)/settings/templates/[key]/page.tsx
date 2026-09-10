import { TemplateEditorContainer } from '../../../../../features/notifications/containers/template-editor-container';

export default function TemplateEditorRoutePage({ params }: { params: { key: string } }) {
  return <TemplateEditorContainer templateKey={params.key} />;
}
