'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Eye, KeyRound, UserX } from 'lucide-react';
import { Pagination } from '../../../components/dashboard/pagination';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { BILLING_STATUS_OPTIONS, derivedPaymentStatus } from '../../cases/billing-status';
import { caseStatusSchema } from '../../cases/schemas/case';
import { cn } from '../../../lib/utils';
import { statusLabel } from '../../../lib/status-labels';
import { withdrawCandidateAction } from '../actions/withdraw-candidate';
import type { CandidatePayload } from '../types';

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

export interface CandidatesTableProps {
  candidates: CandidatePayload[];
  casesByPatientId: Record<string, CandidateCaseSummary[]>;
  /** Whether the viewer can withdraw a candidacy — auditors can view this list but not act on it. */
  canUpdate: boolean;
}

const PAGE_SIZE = 8;

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
 * Filtering/pagination stays client-side over the already-loaded set — same
 * as the Users tables — since candidate counts are small enough not to need
 * server-side paging yet. Rows expand in place rather than navigating away,
 * since a candidate can have several medicals and several actions.
 */
export function CandidatesTable({ candidates, casesByPatientId, canUpdate }: CandidatesTableProps) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const [stage, setStage] = useState('');
  const [billing, setBilling] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const positions = useMemo(() => Array.from(new Set(candidates.map((c) => c.position))).sort(), [candidates]);

  const filtered = useMemo(
    () =>
      candidates.filter((candidate) => {
        const cases = casesByPatientId[candidate.id] ?? [];
        const matchesQuery = !query || candidate.fullName.toLowerCase().includes(query.trim().toLowerCase());
        const matchesPosition = !position || candidate.position === position;
        const matchesStage = !stage || cases.some((c) => c.status === stage);
        const matchesBilling = !billing || cases.some((c) => derivedPaymentStatus(c.status, c.paymentStatus) === billing);
        return matchesQuery && matchesPosition && matchesStage && matchesBilling;
      }),
    [candidates, casesByPatientId, query, position, stage, billing]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updatePosition(value: string) {
    setPosition(value);
    setPage(1);
  }

  function updateStage(value: string) {
    setStage(value);
    setPage(1);
  }

  function updateBilling(value: string) {
    setBilling(value);
    setPage(1);
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
        <Select value={position || ALL_POSITIONS} onValueChange={(value) => updatePosition(value === ALL_POSITIONS ? '' : value)}>
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

        <Select value={stage || ALL_STAGES} onValueChange={(value) => updateStage(value === ALL_STAGES ? '' : value)}>
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

        <Select value={billing || ALL_BILLING} onValueChange={(value) => updateBilling(value === ALL_BILLING ? '' : value)}>
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

      {filtered.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {candidates.length === 0 ? 'No candidates yet.' : 'No candidates match these filters.'}
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
              {pageRows.map((candidate) => {
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

          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
