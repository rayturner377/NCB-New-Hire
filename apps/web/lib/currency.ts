/** Ported from server.js formatCurrency (public/app.js ~L4960-4962). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(Number(value || 0));
}
