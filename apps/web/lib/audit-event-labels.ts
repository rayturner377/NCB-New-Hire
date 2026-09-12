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
  user_created: 'User created',
  user_deleted: 'User deleted',
  user_activated: 'User activated',
  user_deactivated: 'User deactivated',
  user_password_reset: 'Password reset requested',
  account_activated: 'Account activated',
  password_reset_completed: 'Password reset completed',
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
    eventTypes: ['case_created', 'case_transition', 'case_reassigned', 'case_payment_confirmed', 'case_hidden', 'case_unhidden']
  },
  {
    label: 'User accounts',
    eventTypes: [
      'user_created',
      'user_deleted',
      'user_activated',
      'user_deactivated',
      'user_password_reset',
      'account_activated',
      'password_reset_completed'
    ]
  },
  {
    label: 'Sessions & access',
    eventTypes: ['login_success', 'login_failed', 'logout', 'logout_idle_timeout', 'access_denied']
  },
  {
    label: 'Settings',
    eventTypes: ['settings_updated']
  }
];

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}
