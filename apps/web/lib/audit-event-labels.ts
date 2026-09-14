/**
 * Human-readable labels for audit_events.event_type, shared by every place
 * that renders a raw event type to a person: a case's own History tab
 * (case-history.ts), the admin/reviewer dashboard's Recent updates feed
 * (reviewer-dashboard-service.ts), and the full /audit log (audit-log-service.ts).
 */
export const EVENT_LABELS: Record<string, string> = {
  case_created: 'Case created',
  case_transition: 'Status change',
  case_reassigned: 'Reassignment',
  case_payment_confirmed: 'Payment confirmed',
  case_hidden: 'Hidden from queue',
  case_unhidden: 'Unhidden',
  case_attachment_downloaded: 'Attachment downloaded',
  case_attachment_uploaded: 'Attachment uploaded',
  case_attachment_deleted: 'Attachment deleted',
  case_billing_updated: 'Billing updated',
  candidate_created: 'Candidate created',
  candidate_updated: 'Candidate profile updated',
  candidate_withdrawn: 'Candidate withdrawn',
  candidate_clinician_assigned: 'Candidate assigned to clinician',
  medical_office_created: 'Medical office created',
  message_resent: 'Message resent',
  user_created: 'User created',
  user_updated: 'User profile updated',
  user_deleted: 'User deleted',
  user_activated: 'User activated',
  user_deactivated: 'User deactivated',
  user_password_reset: 'Password reset requested by staff',
  password_reset_requested: 'Password reset requested',
  user_permission_overrides_updated: 'Permission overrides updated',
  account_activated: 'Account activated',
  password_changed: 'Password changed',
  password_reset_completed: 'Password reset completed',
  sessions_revoked: 'Other sessions signed out',
  login_success: 'Login',
  login_failed: 'Login failed',
  logout: 'Logout',
  logout_idle_timeout: 'Logout (idle timeout)',
  access_denied: 'Access denied',
  settings_updated: 'Settings updated'
};

export interface EventTypeGroup {
  label: string;
  eventTypes: string[];
}

/** Groups event types for the /audit log's filter dropdown — order here is display order. */
export const EVENT_TYPE_GROUPS: EventTypeGroup[] = [
  {
    label: 'Case activity',
    eventTypes: [
      'case_created',
      'case_transition',
      'case_reassigned',
      'case_payment_confirmed',
      'case_hidden',
      'case_unhidden',
      'case_attachment_downloaded',
      'case_attachment_uploaded',
      'case_attachment_deleted',
      'case_billing_updated'
    ]
  },
  {
    label: 'Candidate activity',
    eventTypes: ['candidate_created', 'candidate_updated', 'candidate_withdrawn', 'candidate_clinician_assigned']
  },
  {
    label: 'User accounts',
    eventTypes: [
      'user_created',
      'user_updated',
      'user_deleted',
      'user_activated',
      'user_deactivated',
      'user_password_reset',
      'password_reset_requested',
      'user_permission_overrides_updated',
      'account_activated',
      'password_changed',
      'password_reset_completed'
    ]
  },
  {
    label: 'Sessions & access',
    eventTypes: ['login_success', 'login_failed', 'logout', 'logout_idle_timeout', 'sessions_revoked', 'access_denied']
  },
  {
    label: 'Settings',
    eventTypes: ['settings_updated', 'medical_office_created', 'message_resent']
  }
];

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}
