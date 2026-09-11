'use client';

import { Fragment, useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { cn } from '../../../lib/utils';
import { PERMISSION_DESCRIPTIONS } from '../../../lib/permission-descriptions';
import { PERMISSIONS, type PermissionOption } from '../../../lib/permissions';
import { updateRolePermissionsAction } from '../actions/update-role-permissions';

/**
 * Permissions where holding the first already grants everything the second would (see
 * canViewMessageCentre/canManageUserAccount's own "inherits with a carve-out" doc comments) — the
 * matrix stores and toggles these as independent DB rows, but showing them as two unrelated
 * checkboxes reads as a contradiction (reviewer's NOTIFICATIONS_VIEW box sits unchecked even
 * though holding NOTIFICATIONS_MANAGE already lets them view). Rendered as a checked-and-disabled
 * "implied" box instead, reflecting what the role can *actually do*, not just its literal rows.
 */
const IMPLIES: Partial<Record<string, string[]>> = {
  [PERMISSIONS.NOTIFICATIONS_MANAGE]: [PERMISSIONS.NOTIFICATIONS_VIEW]
};

export interface PermissionsMatrixRole {
  role: string;
  label: string;
}

export interface PermissionsMatrixProps {
  roles: PermissionsMatrixRole[];
  /** Already flat (not grouped) — this component groups by `.group` itself so section headers and row order come from one place. */
  permissions: PermissionOption[];
  initialPermissionsByRole: Record<string, string[]>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 900;

const STATUS_LABEL: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' };
const STATUS_CLASS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'text-muted-foreground',
  saved: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive'
};

/**
 * One table: rows are permissions (grouped under a shaded category heading), columns are the
 * editable roles, so an admin can compare what reviewer/auditor/doctor/patient each hold at a
 * glance instead of scrolling through separate per-role cards. Autosaves per role on change
 * (debounced — same idea as lib/hooks/use-autosave.ts, reimplemented here without a DOM `<form>`
 * since checkboxes for one role aren't contiguous in the table) rather than a Save button:
 * toggling a box submits that role's complete checked set a moment after you stop clicking it.
 */
export function PermissionsMatrix({ roles, permissions, initialPermissionsByRole }: PermissionsMatrixProps) {
  const [checkedByRole, setCheckedByRole] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    for (const { role } of roles) initial[role] = new Set(initialPermissionsByRole[role] ?? []);
    return initial;
  });
  const [statusByRole, setStatusByRole] = useState<Record<string, SaveStatus>>({});
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(group: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  /** Whichever OTHER permission (already checked for this role) implies `permissionKey` — null if it isn't implied by anything currently checked. */
  function impliedBy(role: string, permissionKey: string): string | null {
    const checked = checkedByRole[role];
    if (!checked) return null;
    for (const [source, targets] of Object.entries(IMPLIES)) {
      if (checked.has(source) && targets?.includes(permissionKey)) return source;
    }
    return null;
  }

  const checkedRef = useRef(checkedByRole);
  checkedRef.current = checkedByRole;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const savingRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, boolean>>({});

  const saveRole = useCallback(async (role: string) => {
    if (savingRef.current[role]) {
      pendingRef.current[role] = true;
      return;
    }
    savingRef.current[role] = true;
    setStatusByRole((current) => ({ ...current, [role]: 'saving' }));

    const formData = new FormData();
    formData.set('role', role);
    for (const key of checkedRef.current[role] ?? []) formData.append('permissions', key);

    let ok = false;
    try {
      const result = await updateRolePermissionsAction(null, formData);
      ok = result.ok;
    } catch {
      ok = false;
    }
    setStatusByRole((current) => ({ ...current, [role]: ok ? 'saved' : 'error' }));
    savingRef.current[role] = false;
    if (pendingRef.current[role]) {
      pendingRef.current[role] = false;
      void saveRole(role);
    }
  }, []);

  function toggle(role: string, permissionKey: string) {
    setCheckedByRole((current) => {
      const next = new Set(current[role]);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      const updated = { ...current, [role]: next };
      checkedRef.current = updated;
      return updated;
    });

    if (timers.current[role]) clearTimeout(timers.current[role]);
    timers.current[role] = setTimeout(() => void saveRole(role), DEBOUNCE_MS);
  }

  const groups = new Map<string, PermissionOption[]>();
  for (const option of permissions) {
    const list = groups.get(option.group) ?? [];
    list.push(option);
    groups.set(option.group, list);
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Area</TableHead>
              {roles.map(({ role, label }) => (
                <TableHead key={role} className="text-center text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{label}</span>
                    <span className={cn('text-[10px] normal-case tracking-normal', STATUS_CLASS[statusByRole[role] ?? 'idle'])}>
                      {STATUS_LABEL[statusByRole[role] ?? 'idle']}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...groups.entries()].map(([group, options]) => {
              const isOpen = openGroups.has(group);
              return (
                <Fragment key={group}>
                  <TableRow className="cursor-pointer bg-muted/50 hover:bg-muted" onClick={() => toggleGroup(group)}>
                    <TableCell
                      colSpan={roles.length + 1}
                      className="flex items-center gap-1.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {group.replace(/_/g, ' ')}
                      <span className="font-normal normal-case text-muted-foreground/70">({options.length})</span>
                    </TableCell>
                  </TableRow>
                  {isOpen
                    ? options.map((option) => (
                        <TableRow key={option.key}>
                          <TableCell className="text-sm">
                            {PERMISSION_DESCRIPTIONS[option.key] ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-4">{option.label}</span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-64">
                                  {PERMISSION_DESCRIPTIONS[option.key]}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              option.label
                            )}
                          </TableCell>
                          {roles.map(({ role }) => {
                            const impliedSource = impliedBy(role, option.key);
                            const checked = impliedSource ? true : (checkedByRole[role]?.has(option.key) ?? false);
                            const box = (
                              <Checkbox
                                aria-label={`${option.label} for ${role}`}
                                checked={checked}
                                disabled={Boolean(impliedSource)}
                                onCheckedChange={() => toggle(role, option.key)}
                              />
                            );
                            return (
                              <TableCell key={role} className="text-center">
                                {impliedSource ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help">{box}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-56">
                                      Already included — this role holds &ldquo;{impliedSource.split(':')[1]?.replace(/_/g, ' ')}&rdquo;, which
                                      covers this too.
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  box
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
