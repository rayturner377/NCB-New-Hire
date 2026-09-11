import { TemplateEditorContainer } from '../../../../../features/notifications/containers/template-editor-container';

export default async function TemplateEditorRoutePage(props: { params: Promise<{ key: string }> }) {
  const params = await props.params;
  return <TemplateEditorContainer templateKey={params.key} />;
}
