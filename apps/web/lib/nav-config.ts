import { Briefcase, DollarSign, LayoutDashboard, Mail, Settings, UserCog, type LucideIcon } from 'lucide-react';
import { ROLES, type Role } from './permissions';

export interface NavChildItem {
  href: string;
  label: string;
  roles: readonly Role[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  children?: readonly NavChildItem[];
}

/**
 * Roles are listed explicitly rather than derived from PERMISSIONS: the
 * underlying page containers don't scope every list to "my own records" for
 * every role that technically holds the list permission (e.g. a patient
 * holds MEDICAL_CASES_LIST but /cases renders every case in the system, not
 * just theirs). Keeping the roles allowlist here in sync with what each
 * container actually scopes correctly avoids surfacing a nav link into a
 * page that would over-share data for that role.
 *
 * "Users" is a group: each child keeps its own roles rather than the group
 * inheriting one role list, because Candidates is still visible to
 * doctor/reviewer (scoped to their own view) even though the other children
 * (role-filtered user lists, +New) are admin-only — nesting Candidates here
 * shouldn't take away a doctor's access to it.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR, ROLES.PATIENT] },
  { href: '/billing', label: 'Billing report', icon: DollarSign, roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR] },
  { href: '/cases', label: 'Cases', icon: Briefcase, roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
  {
    href: '/users',
    label: 'Users',
    icon: UserCog,
    // DOCTOR deliberately dropped from this group's own roles too — Candidates was its only
    // child a doctor could see, and that access is gone now (see permissions.ts's comment on
    // ROLE_PERMISSIONS[ROLES.DOCTOR] for why): a doctor has no legitimate reason to browse the
    // candidate roster, only the patients on cases actually assigned to them.
    roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR],
    children: [
      { href: '/candidates', label: 'Candidates', roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
      // Medical facilities live as a tab on this same page (see
      // DoctorsWorkspaceContainer) rather than their own nav entry — reached
      // from within the Doctors page, not the sidebar. REVIEWER/AUDITOR hold
      // DOCTORS_LIST (and REVIEWER additionally STAFF_ACCOUNTS_MANAGE) — this
      // was previously admin-only here despite that, leaving both roles with
      // no sidebar path to a page they could already reach directly by URL.
      { href: '/doctors?tab=doctors', label: 'Doctors', roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
      { href: '/reviewers', label: 'Reviewers', roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
      { href: '/auditors', label: 'Auditors', roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
      { href: '/admins', label: 'Admins', roles: [ROLES.ADMIN] }
    ]
  },
  // AUDITOR holds NOTIFICATIONS_VIEW (read-only Message Centre access — see
  // canViewMessageCentre) alongside REVIEWER/ADMIN's own NOTIFICATIONS_MANAGE.
  { href: '/messages', label: 'Message Centre', icon: Mail, roles: [ROLES.ADMIN, ROLES.REVIEWER, ROLES.AUDITOR] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: [ROLES.ADMIN] }
];

/**
 * Whether `href` (a nav/breadcrumb entry, possibly carrying a `?tab=...`
 * query — see the Doctors/Medical facilities entries above) matches the
 * current location. An href with a query requires an exact match on both
 * path and query, so two links that share a pathname but pick different
 * tabs are never both "active" at once; an href without one falls back to
 * the old prefix match (so /candidates/new still counts as being under
 * /candidates).
 */
export function isNavHrefActive(pathname: string, search: string, href: string): boolean {
  const [hrefPath, hrefQuery] = href.split('?');
  if (hrefQuery !== undefined) {
    return pathname === hrefPath && search === hrefQuery;
  }
  return hrefPath === '/' ? pathname === '/' : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function childrenForRole(item: NavItem, role: string | undefined | null): NavChildItem[] {
  return (item.children ?? []).filter((child) => child.roles.includes(role as Role));
}

/** Filters both top-level items and their children down to what this role can see; drops a group entirely if none of its children are visible. */
export function navItemsForRole(role: string | undefined | null): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role as Role))
    .map((item) => (item.children ? { ...item, children: childrenForRole(item, role) } : item))
    .filter((item) => !item.children || item.children.length > 0);
}

/**
 * Looks up the nav label for the current route (longest href first, so
 * `/cases` doesn't win over a hypothetical `/cases/:id`) — lets the Topbar
 * show a page title without every page having to declare its own. Checks
 * children too, since a route like /candidates only exists as a child now.
 * `search` (no leading `?`) disambiguates two entries sharing a pathname but
 * naming different tabs, e.g. /doctors?tab=doctors vs /doctors?tab=offices.
 */
export function navLabelForPathname(pathname: string, search = ''): string | null {
  return navBreadcrumbsForPathname(pathname, search).at(-1)?.label ?? null;
}

export interface Breadcrumb {
  label: string;
  href: string;
}

function singularize(label: string): string {
  return label.endsWith('s') ? label.slice(0, -1) : label;
}

/**
 * Pages the Topbar needs a title for that aren't themselves a sidebar
 * destination — reached only via a link from elsewhere (e.g. a doctor's
 * inbox row), not a route anyone browses to directly. Kept separate from
 * NAV_ITEMS so adding one doesn't also add a sidebar link.
 */
const EXTRA_ROUTE_TITLES: Breadcrumb[] = [
  { href: '/submissions/new', label: 'Complete assessment' },
  // Reached only from the dashboard's "View full audit log" button, not its own sidebar entry.
  { href: '/audit', label: 'Audit log' },
  // Reached only from the account dropdown next to Sign out, not its own sidebar entry.
  { href: '/profile', label: 'My profile' },
  // Plain (query-less) fallback for /doctors' own sub-routes (/doctors/new,
  // /doctors/[id]) — the two tab-specific entries above require an exact
  // query match, so neither of them catches these; this one uses the old
  // prefix match instead (see isNavHrefActive).
  { href: '/doctors', label: 'Doctors' },
  // Not its own nav destination anymore (see NAV_ITEMS' Doctors/Medical
  // facilities entries) — still a real route (its /new and /[id] edit pages
  // are linked to from the Doctors page's Medical facilities tab), just
  // reached as a tab rather than a sidebar link.
  { href: '/medical-offices', label: 'Medical facilities' }
];

/**
 * Breadcrumb trail for the Topbar — the matched nav entry (own label), plus
 * one more crumb when the route goes a level deeper than that entry (e.g.
 * /candidates/new under /candidates). Dynamic segments (a resource id) don't
 * have a friendly name available here, so they fall back to "Details"
 * rather than showing the raw id. `search` (no leading `?`) is only relevant
 * to entries that name a specific tab — see isNavHrefActive.
 */
export function navBreadcrumbsForPathname(pathname: string, search = ''): Breadcrumb[] {
  const flat = [
    ...NAV_ITEMS.flatMap((item) => [{ href: item.href, label: item.label }, ...(item.children ?? [])]),
    ...EXTRA_ROUTE_TITLES
  ];
  const byLongestHref = [...flat].sort((a, b) => b.href.length - a.href.length);
  const match = byLongestHref.find((item) => isNavHrefActive(pathname, search, item.href));
  if (!match) return [];

  const baseHref = match.href.split('?')[0]!;
  const crumbs: Breadcrumb[] = [{ label: match.label, href: match.href }];

  if (pathname !== baseHref && baseHref !== '/') {
    const suffix = pathname.slice(baseHref.length).replace(/^\//, '');
    const label = suffix === 'new' ? `New ${singularize(match.label).toLowerCase()}` : 'Details';
    crumbs.push({ label, href: pathname });
  }

  return crumbs;
}
