/**
 * Opts /candidates/new out of the parent /candidates/loading.tsx (a table
 * skeleton, wrong shape for a creation form) — this page is a simple form
 * with no heavy data fetch, so it doesn't need a skeleton of its own either;
 * the global top-of-page progress bar (see app/layout.tsx) is signal enough.
 */
export default function Loading() {
  return null;
}
