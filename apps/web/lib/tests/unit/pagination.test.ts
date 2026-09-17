import { describe, expect, it } from 'vitest';
import { parsePageNumber } from '../../pagination';

describe('parsePageNumber', () => {
  it('parses a valid positive integer string', () => {
    expect(parsePageNumber('3')).toBe(3);
  });

  it('defaults to 1 when missing', () => {
    expect(parsePageNumber(undefined)).toBe(1);
  });

  it('defaults to 1 for a non-numeric value', () => {
    expect(parsePageNumber('abc')).toBe(1);
  });

  it('defaults to 1 for a fractional value', () => {
    expect(parsePageNumber('1.5')).toBe(1);
  });

  it('defaults to 1 for zero or negative values', () => {
    expect(parsePageNumber('0')).toBe(1);
    expect(parsePageNumber('-3')).toBe(1);
  });

  it('defaults to 1 for Infinity, which a plain `Number(x) || 1` would let through since Infinity is truthy', () => {
    expect(parsePageNumber('Infinity')).toBe(1);
  });
});
