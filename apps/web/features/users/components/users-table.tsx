'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, LayoutDashboard, Pencil, Trash2 } from 'lucide-react';
import { Pagination } from '../../../components/dashboard/pagination';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Switch } from '../../../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { cn } from '../../../lib/utils';
import { LIST_PATH_BY_ROLE } from '../../../lib/role-list-paths';
import { deleteUserAction } from '../actions/delete-user';
import { setUserActiveAction } from '../actions/set-user-active';
import type { UserSummary } from '../types';

export interface UsersTableProps {
  users: UserSummary[];
  currentUserId: string;
  /** Doctors only — total/active case counts per doctor id, prefetched by the container. */
  caseCounts?: Record<string, { total: number; active: number }>;
  /** canManageUserAccount(actor, role) for the role this table is scoped to — see role-users-container.tsx/doctors-workspace-container.tsx. Hides Edit/Deactivate/Delete entirely for a view-only viewer (e.g. an auditor), rather than rendering controls that would just be rejected server-side if used. */
  canManage: boolean;
}

const PAGE_SIZE = 8;
const HEAD_CLASS = 'h-auto px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-3 py-2.5';

/** Activate/deactivate as a single-click Switch (checked = active) instead of a text button whose own label flips — submits setUserActiveAction the moment it's toggled, no separate confirm step (matches the old button's behavior, which also fired immediately). */
function ActiveSwitch({ userId, active }: { userId: string; active: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={setUserActiveAction} onClick={(event) => event.stopPropagation()}>
      <input type="hidden" name="userId" value={userId} />
      <input ref={activeInputRef} type="hidden" name="active" defaultValue={String(!active)} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Switch
            checked={active}
            aria-label={active ? 'Deactivate' : 'Activate'}
            onCheckedChange={(checked) => {
              if (activeInputRef.current) activeInputRef.current.value = String(checked);
              formRef.current?.requestSubmit();
            }}
          />
        </TooltipTrigger>
        <TooltipContent>{active ? 'Deactivate' : 'Activate'}</TooltipContent>
      </Tooltip>
    </form>
  );
}

/**
 * Searchable, paginated, real-data table — same shadcn Table conventions and
 * expand-in-place pattern as CandidatesTable. The collapsed row is a plain
 * summary; Edit (a link to that role's own /[id]/edit page — see
 * edit-role-user-container.tsx), the active Switch, and Delete live in the
 * expanded panel only, so clicking those never fights the row's own
 * click-to-expand handler.
 */
export function UsersTable({ users, currentUserId, caseCounts, canManage }: UsersTableProps) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.displayName.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle));
  }, [users, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        <Input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search by name or email…" className="sm:max-w-sm" />

        {filtered.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No accounts match this search.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(HEAD_CLASS, 'w-8')} />
                  <TableHead className={HEAD_CLASS}>Name</TableHead>
                  <TableHead className={HEAD_CLASS}>Email</TableHead>
                  <TableHead className={HEAD_CLASS}>Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((user) => {
                  const isExpanded = expandedId === user.id;
                  const counts = caseCounts?.[user.id];
                  const editHref = `${LIST_PATH_BY_ROLE[user.role] ?? ''}/${user.id}/edit`;
                  return (
                    <Fragment key={user.id}>
                      <TableRow
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(user.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleExpanded(user.id);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <TableCell className={CELL_CLASS}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className={cn(CELL_CLASS, 'text-xs font-semibold')}>{user.displayName}</TableCell>
                        <TableCell className={cn(CELL_CLASS, 'text-xs text-muted-foreground')}>{user.email}</TableCell>
                        <TableCell className={CELL_CLASS}>
                          <StatusBadge status={user.active ? 'active' : 'inactive'} />
                        </TableCell>
                        <TableCell className={cn(CELL_CLASS, 'text-xs text-muted-foreground')}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>

                      {isExpanded ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="px-3 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              {counts ? (
                                <div className="flex gap-6 text-xs">
                                  <div>
                                    <div className="text-base font-semibold leading-none">{counts.total}</div>
                                    <div className="mt-1 text-muted-foreground">Total cases</div>
                                  </div>
                                  <div>
                                    <div className="text-base font-semibold leading-none">{counts.active}</div>
                                    <div className="mt-1 text-muted-foreground">Active cases</div>
                                  </div>
                                </div>
                              ) : (
                                <span />
                              )}

                              <div className="flex flex-wrap items-center gap-3" onClick={(event) => event.stopPropagation()}>
                                {counts ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="outline" size="icon" asChild>
                                        <Link href={`/doctors/${user.id}`} aria-label="View dashboard">
                                          <LayoutDashboard className="h-3.5 w-3.5" />
                                        </Link>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View dashboard</TooltipContent>
                                  </Tooltip>
                                ) : null}

                                {canManage ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="outline" size="icon" asChild>
                                        <Link href={editHref} aria-label="Edit">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Link>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit</TooltipContent>
                                  </Tooltip>
                                ) : null}

                                {canManage && user.id !== currentUserId ? (
                                  <>
                                    <ActiveSwitch userId={user.id} active={user.active} />

                                    <form action={deleteUserAction}>
                                      <input type="hidden" name="userId" value={user.id} />
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="submit"
                                            variant="outline"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            aria-label="Delete"
                                            onClick={(event) => {
                                              if (!window.confirm(`Delete ${user.displayName}? This can't be undone.`)) {
                                                event.preventDefault();
                                              }
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                    </form>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
