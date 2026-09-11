import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../../relative-time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-01-02T12:00:00.000Z');

  it('returns "Just now" for anything under an hour ago', () => {
    expect(formatRelativeTime('2026-01-02T11:30:00.000Z', now)).toBe('Just now');
  });

  it('returns rounded hours for same-day events', () => {
    expect(formatRelativeTime('2026-01-02T09:00:00.000Z', now)).toBe('3h ago');
  });

  it('returns rounded days once past 24 hours', () => {
    expect(formatRelativeTime('2025-12-30T12:00:00.000Z', now)).toBe('3d ago');
  });
});
