/**
 * The `email_messages.template_key` value written by Settings → Mail's "Send
 * test email" button (settings/actions/send-test-email.ts) — not a real
 * notification template (see notifications/registry.ts), just a fixed tag so
 * the Message Centre (messages-service.ts) can label and categorize those
 * rows distinctly from an actual notification send.
 */
export const TEST_EMAIL_TEMPLATE_KEY = 'test_email';
