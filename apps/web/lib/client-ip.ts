import { headers } from 'next/headers';

/** Ported from server.js getClientIp (~L5192-5198). */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return 'unknown';
}
