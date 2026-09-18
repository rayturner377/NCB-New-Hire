import { describe, expect, it } from 'vitest';
import { isNavHrefActive, navBreadcrumbsForPathname, navItemsForRole, navLabelForPathname } from '../../nav-config';

describe('isNavHrefActive', () => {
  it('matches an exact plain path', () => {
    expect(isNavHrefActive('/cases', '', '/cases')).toBe(true);
  });

  it('matches a sub-path via prefix for a plain href', () => {
    expect(isNavHrefActive('/candidates/new', '', '/candidates')).toBe(true);
  });

  it('does not match an unrelated path that merely shares a prefix string', () => {
    expect(isNavHrefActive('/candidatesomething', '', '/candidates')).toBe(false);
  });

  it('treats "/" specially — only exactly "/" counts as active, no prefix matching', () => {
    expect(isNavHrefActive('/billing', '', '/')).toBe(false);
    expect(isNavHrefActive('/', '', '/')).toBe(true);
  });

  it('requires an exact query match for an href that names one, ignoring prefix rules', () => {
    expect(isNavHrefActive('/doctors', 'tab=doctors', '/doctors?tab=doctors')).toBe(true);
    expect(isNavHrefActive('/doctors', 'tab=offices', '/doctors?tab=doctors')).toBe(false);
    expect(isNavHrefActive('/doctors/new', 'tab=doctors', '/doctors?tab=doctors')).toBe(false);
  });
});

describe('navItemsForRole', () => {
  it('drops the whole Users group for a role with no visible children (e.g. patient)', () => {
    const items = navItemsForRole('patient');
    expect(items.some((item) => item.label === 'Users')).toBe(false);
  });

  it('scopes the Users group down to only the children an admin-adjacent role can see', () => {
    const items = navItemsForRole('reviewer');
    const usersGroup = items.find((item) => item.label === 'Users');
    expect(usersGroup?.children?.some((child) => child.label === 'Admins')).toBe(false);
    expect(usersGroup?.children?.some((child) => child.label === 'Candidates')).toBe(true);
  });

  it('includes every child for an admin', () => {
    const items = navItemsForRole('admin');
    const usersGroup = items.find((item) => item.label === 'Users');
    expect(usersGroup?.children?.some((child) => child.label === 'Admins')).toBe(true);
  });

  it('returns no items for an unrecognized/missing role', () => {
    expect(navItemsForRole(undefined)).toEqual([]);
    expect(navItemsForRole(null)).toEqual([]);
  });

  it('shows HR turnaround to reviewer/admin but not doctor (no doctor-scoped equivalent exists)', () => {
    expect(navItemsForRole('reviewer').some((item) => item.label === 'HR turnaround')).toBe(true);
    expect(navItemsForRole('admin').some((item) => item.label === 'HR turnaround')).toBe(true);
    expect(navItemsForRole('clinician').some((item) => item.label === 'HR turnaround')).toBe(false);
  });
});

describe('navLabelForPathname', () => {
  it('resolves the label for a top-level route', () => {
    expect(navLabelForPathname('/billing')).toBe('Billing report');
  });

  it('resolves the label for a nested child route', () => {
    expect(navLabelForPathname('/candidates')).toBe('Candidates');
  });

  it('matches the exact-query nav entry when the query matches, falling back to the plain prefix entry otherwise', () => {
    expect(navLabelForPathname('/doctors', 'tab=doctors')).toBe('Doctors');
    // No nav entry names tab=offices specifically, so this falls through to
    // EXTRA_ROUTE_TITLES' plain '/doctors' entry (prefix match, query ignored).
    expect(navLabelForPathname('/doctors', 'tab=offices')).toBe('Doctors');
  });

  it('returns null for a route with no matching entry at all', () => {
    expect(navLabelForPathname('/nowhere')).toBeNull();
  });
});

describe('navBreadcrumbsForPathname', () => {
  it('returns just the matched entry when the path is exactly the nav href', () => {
    expect(navBreadcrumbsForPathname('/candidates')).toEqual([{ label: 'Candidates', href: '/candidates' }]);
  });

  it('adds a "New X" crumb for a /new sub-route', () => {
    const crumbs = navBreadcrumbsForPathname('/candidates/new');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1]).toEqual({ label: 'New candidate', href: '/candidates/new' });
  });

  it('adds a generic "Details" crumb for a dynamic id sub-route', () => {
    const crumbs = navBreadcrumbsForPathname('/candidates/cand_1');
    expect(crumbs[1]).toEqual({ label: 'Details', href: '/candidates/cand_1' });
  });

  it('returns an empty list for an unmatched pathname', () => {
    expect(navBreadcrumbsForPathname('/nowhere')).toEqual([]);
  });

  it('does not add a second crumb for the root path itself', () => {
    expect(navBreadcrumbsForPathname('/')).toEqual([{ label: 'Dashboard', href: '/' }]);
  });
});
