import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseWorkspaceTabs } from '../../components/case-workspace-tabs';

const state = vi.hoisted(() => ({ search: 'tab=billing' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }));

afterEach(() => { vi.unstubAllGlobals(); });

describe('case workspace URL tabs', () => {
  it('reads deep links and subsequent URL changes instead of only setting a default tab', () => {
    state.search = 'tab=billing';
    expect(CaseWorkspaceTabs({ canViewHistory: true, children: null }).props.value).toBe('billing');
    state.search = 'tab=documents';
    expect(CaseWorkspaceTabs({ canViewHistory: true, children: null }).props.value).toBe('documents');
    state.search = '';
    expect(CaseWorkspaceTabs({ canViewHistory: true, children: null }).props.value).toBe('overview');
  });

  it('preserves other query parameters and the fragment when selecting a tab', () => {
    const pushState = vi.fn();
    vi.stubGlobal('window', { location: { href: 'http://localhost/cases/case_1?from=audit#content' }, history: { pushState } });
    CaseWorkspaceTabs({ canViewHistory: true, children: null }).props.onValueChange('documents');
    expect(pushState).toHaveBeenCalledWith(null, '', '/cases/case_1?from=audit&tab=documents#content');
  });
});
