'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Eye, KeyRound, UserX } from 'lucide-react';
import { Pagination } from '../../../components/dashboard/pagination';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { BILLING_STATUS_OPTIONS } from '../../cases/billing-status';
import { caseStatusSchema } from '../../cases/schemas/case';
import { cn } from '../../../lib/utils';
import { statusLabel } from '../../../lib/status-labels';
import { withdrawCandidateAction } from '../actions/withdraw-candidate';
import type { CandidateListRow } from '../services/candidates-service';

export interface CandidateCaseSummary {
  id: string;
  status: string;
  paymentStatus: string | null;
  positionAppliedFor: string;
  createdAt: string;
  assignedAt: string | null;
  /** 1-based, in creation order — assigned once in the container so it stays stable across sorting/filtering (see candidates-container.tsx). */
  caseNumber?: number;
}

interface CandidatesFilterValues {
  query: string;
  position: string;
  stage: string;
  billing: string;
}

export interface CandidatesTableProps {
  /** Already the current page's rows only — filtering/pagination happens server-side (see candidates-container.tsx's use of searchCandidates). */
  candidates: CandidateListRow[];
  casesByPatientId: Record<string, CandidateCaseSummary[]>;
  /** Whether the viewer can withdraw a candidacy — auditors can view this list but not act on it. */
  canUpdate: boolean;
  /** Every distinct position on file, for the filter dropdown — see listCandidatePositions. */
  positions: string[];
  query: string;
  position: string;
  stage: string;
  billing: string;
  page: number;
  totalPages: number;
  /** Builds the href for a given filter/page combination — mirrors cases-filters.tsx/users-table.tsx's own pattern. */
  buildHref: (params: CandidatesFilterValues & { page: number }) => string;
}

const DEBOUNCE_MS = 400;

const ALL_POSITIONS = '__all__';
const ALL_STAGES = '__all__';
const ALL_BILLING = '__all__';

const HEAD_CLASS = 'h-auto px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-3 py-2.5';

const CASE_STAGE_OPTIONS = caseStatusSchema.options;

function sortedByNewest(cases: CandidateCaseSummary[]): CandidateCaseSummary[] {
  return [...cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function caseTitle(medicalCase: CandidateCaseSummary): string {
  const number = medicalCase.caseNumber ? `Case #${medicalCase.caseNumber}` : 'Case';
  return medicalCase.positionAppliedFor ? `${number} — ${medicalCase.positionAppliedFor}` : number;
}

/**
 * Real candidates (features/candidates/services/candidates-service.ts), real
 * cases grouped by patientId (fetched once in the container, not per row).
 * Filtering/pagination happens server-side (see candidates-container.tsx) —
 * this component only decides *when* to navigate to a new filter/page combo,
 * the same debounced-search-input pattern cases-filters.tsx/users-table.tsx
 * already established. Rows expand in place rather than navigating away,
 * since a candidate can have several medicals and several actions.
 */
export function CandidatesTable({
  candidates,
  casesByPatientId,
  canUpdate,
  positions,
  query: initialQuery,
  position,
  stage,
  billing,
  page,
  totalPages,
  buildHref
}: CandidatesTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  function navigate(next: Partial<CandidatesFilterValues>) {
    router.push(buildHref({ query, position, stage, billing, page: 1, ...next }));
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ query: value }), DEBOUNCE_MS);
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Search by candidate name…"
          className="sm:max-w-sm"
        />
        <Select value={position || ALL_POSITIONS} onValueChange={(value) => navigate({ position: value === ALL_POSITIONS ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[10rem]">
            <SelectValue placeholder="All positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_POSITIONS}>All positions</SelectItem>
            {positions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stage || ALL_STAGES} onValueChange={(value) => navigate({ stage: value === ALL_STAGES ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[11rem]">
            <SelectValue placeholder="All medical stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STAGES}>All medical stages</SelectItem>
            {CASE_STAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={billing || ALL_BILLING} onValueChange={(value) => navigate({ billing: value === ALL_BILLING ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[11rem]">
            <SelectValue placeholder="All billing statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BILLING}>All billing statuses</SelectItem>
            {BILLING_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {!query && !position && !stage && !billing ? 'No candidates yet.' : 'No candidates match these filters.'}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(HEAD_CLASS, 'w-8')} />
                <TableHead className={HEAD_CLASS}>Candidate</TableHead>
                <TableHead className={HEAD_CLASS}>Position</TableHead>
                <TableHead className={HEAD_CLASS}>Status</TableHead>
                <TableHead className={HEAD_CLASS}># Medicals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => {
                const isExpanded = expandedId === candidate.id;
                const cases = casesByPatientId[candidate.id] ?? [];
                return (
                  <Fragment key={candidate.id}>
                    <TableRow
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(candidate.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleExpanded(candidate.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <TableCell className={CELL_CLASS}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{candidate.fullName}</span>
                          <span className="text-[11px] text-muted-foreground">{candidate.employeeId || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-xs')}>{candidate.position}</TableCell>
                      <TableCell className={CELL_CLASS}>
                        <StatusBadge status={candidate.status} />
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-xs')}>{cases.length}</TableCell>
                    </TableRow>

                    {isExpanded ? (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="px-3 py-4">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5" />
                                {candidate.linkedUserId ? 'Portal access granted' : 'No portal access'}
                              </span>
                              {candidate.email ? <span>{candidate.email}</span> : null}
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                                Medical cases
                              </p>
                              {cases.length ? (
                                <div className="overflow-hidden rounded-md border bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className={HEAD_CLASS}>Case</TableHead>
                                        <TableHead className={HEAD_CLASS}>Status</TableHead>
                                        <TableHead className={HEAD_CLASS}>Created</TableHead>
                                        <TableHead className={HEAD_CLASS}>Assigned</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sortedByNewest(cases).map((medicalCase) => (
                                        <TableRow
                                          key={medicalCase.id}
                                          role="link"
                                          tabIndex={0}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            window.location.href = `/cases/${medicalCase.id}`;
                                          }}
                                          className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                                        >
                                          <TableCell className={cn(CELL_CLASS, 'text-xs font-medium')}>{caseTitle(medicalCase)}</TableCell>
                                          <TableCell className={CELL_CLASS}>
                                            <StatusBadge status={medicalCase.status} />
                                          </TableCell>
                                          <TableCell className={cn(CELL_CLASS, 'text-xs text-muted-foreground')}>
                                            {new Date(medicalCase.createdAt).toLocaleDateString()}
                                          </TableCell>
                                          <TableCell className={cn(CELL_CLASS, 'text-xs text-muted-foreground')}>
                                            {medicalCase.assignedAt ? new Date(medicalCase.assignedAt).toLocaleDateString() : '—'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No medical cases yet.</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                              <Button size="sm" variant="secondary" asChild>
                                <Link href={`/candidates/${candidate.id}`}>
                                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View candidate
                                </Link>
                              </Button>
                              {canUpdate && candidate.status !== 'withdrawn' ? (
                                <form action={withdrawCandidateAction}>
                                  <input type="hidden" name="candidateId" value={candidate.id} />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="outline"
                                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(event) => {
                                      if (!window.confirm(`Withdraw ${candidate.fullName}'s candidacy?`)) {
                                        event.preventDefault();
                                      }
                                    }}
                                  >
                                    <UserX className="mr-1.5 h-3.5 w-3.5" /> Withdraw candidate
                                  </Button>
                                </form>
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

          <Pagination page={page} totalPages={totalPages} hrefForPage={(target) => buildHref({ query, position, stage, billing, page: target })} />
        </>
      )}
    </div>
  );
}
