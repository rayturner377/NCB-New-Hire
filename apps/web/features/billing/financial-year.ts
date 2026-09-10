/**
 * NCB Jamaica's financial year runs October 1 – September 30, named for the
 * calendar year it *ends* in — "FY26" is October 2025 through September
 * 2026. Only used by the admin/reviewer org-wide billing report
 * (organization-billing-report-container.tsx); a doctor's own /billing stays
 * on the plain all-time/custom-range filtering it already had.
 */

const FY_LABEL_PATTERN = /^FY(\d{2})$/i;

/** All boundary math is in UTC, matching every other date filter in this app (see cases-container.tsx/billing-report-service.ts's `${value}T00:00:00.000Z` convention) — there's no per-user timezone setting to account for. */
export function financialYearLabelForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  const fyEndYear = month >= 10 ? year + 1 : year;
  return `FY${String(fyEndYear).slice(-2)}`;
}

export function currentFinancialYearLabel(): string {
  return financialYearLabelForDate(new Date());
}

/** @returns null for a string that isn't a well-formed "FY##" label. */
export function financialYearBounds(label: string): { from: string; to: string } | null {
  const match = FY_LABEL_PATTERN.exec(label.trim());
  if (!match) return null;
  const fyEndYear = 2000 + Number(match[1]);
  return { from: `${fyEndYear - 1}-10-01`, to: `${fyEndYear}-09-30` };
}

/**
 * The single FY that fully contains [from, to] (both bounds inside the same
 * FY), or null if the range spans an FY boundary, extends past one end, or
 * either bound is missing — used to derive what the FY dropdown should show
 * purely from whatever date range is actually in effect, rather than
 * tracking "which FY did the user pick" as separate state. Since financial
 * years don't overlap, a range is contained in at most one FY (the one
 * `from` itself falls in), so it's enough to check that `to` also falls
 * inside that same FY's bounds.
 */
export function containingFinancialYear(from: string, to: string): string | null {
  if (!from || !to) return null;
  const label = financialYearLabelForDate(new Date(`${from}T00:00:00.000Z`));
  const bounds = financialYearBounds(label);
  if (!bounds) return null;
  return from >= bounds.from && to <= bounds.to ? label : null;
}

/** Every FY from the one `earliest` falls in through the current one, most recent first — always includes the current FY even with no data yet, so the dropdown is never empty. */
export function financialYearOptions(earliest: Date | null): string[] {
  const currentEndYear = 2000 + Number(currentFinancialYearLabel().slice(2));
  const earliestEndYear = earliest ? 2000 + Number(financialYearLabelForDate(earliest).slice(2)) : currentEndYear;
  const startYear = Math.min(earliestEndYear, currentEndYear);

  const labels: string[] = [];
  for (let year = currentEndYear; year >= startYear; year -= 1) {
    labels.push(`FY${String(year).slice(-2)}`);
  }
  return labels;
}
