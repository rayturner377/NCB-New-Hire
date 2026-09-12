/**
 * Realistic stand-ins for every {{variable}} a notification template might use — shared by the
 * template editor's own live preview (template-editor-page.tsx) and Settings → Mail's "send test
 * email" feature when an admin picks a real template to preview via an actual SMTP send
 * (send-test-email.ts), so both paths show the same sample data. {{loginUrl}} in particular needs
 * a real URL-shaped sample so the de-linked (letter-spaced) rendering the NCB Email Design Style
 * Guide requires is actually visible, not a bare placeholder token.
 */
export const SAMPLE_VARIABLE_VALUES: Record<string, string> = {
  caseId: 'CASE-1234',
  patientName: 'Jane Doe',
  doctorName: 'Dr. Andre Simms',
  paidOn: 'Sep 7, 2026',
  recipientName: 'Jane Doe',
  email: 'jane.doe@example.com',
  resetCode: '482913',
  activationCode: '482913',
  loginUrl: 'https://portal.ncb.local/login',
  resetUrl: 'https://portal.ncb.local/forgot-password'
};
