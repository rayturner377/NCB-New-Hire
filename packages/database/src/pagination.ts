/** The shape every paginated repository query returns — one page of rows plus the total count matching the same filter, so a caller can compute totalPages without a second round trip. */
export interface PaginatedResult<T> {
  rows: T[];
  total: number;
}
