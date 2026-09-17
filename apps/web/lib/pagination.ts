/**
 * Parses a `?page=` query param into a valid positive integer, defaulting to 1 for anything
 * malformed — missing, non-numeric, fractional (`1.5`), zero/negative, or infinite (`Infinity`,
 * which `Number(x) || 1` alone would let straight through since `Infinity` is truthy). A raw
 * value like that reaching a repository's `skip`/`take` calculation could produce a fractional or
 * infinite offset, which Postgres/Prisma were never meant to see.
 */
export function parsePageNumber(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}
