import { describe, it, expect } from 'vitest';
import { normalizeStateCode } from './state';

describe('client normalizeStateCode', () => {
  it('defaults to NC when value is null, undefined, or empty', () => {
    expect(normalizeStateCode(null)).toBe('NC');
    expect(normalizeStateCode(undefined)).toBe('NC');
    expect(normalizeStateCode('')).toBe('NC');
    expect(normalizeStateCode('   ')).toBe('NC');
  });

  it('normalizes North Carolina and nc to NC', () => {
    expect(normalizeStateCode('North Carolina')).toBe('NC');
    expect(normalizeStateCode('north carolina')).toBe('NC');
    expect(normalizeStateCode('nc')).toBe('NC');
    expect(normalizeStateCode('NC')).toBe('NC');
  });

  it('normalizes other state names to 2-letter codes', () => {
    expect(normalizeStateCode('Virginia')).toBe('VA');
    expect(normalizeStateCode('South Carolina')).toBe('SC');
    expect(normalizeStateCode('New York')).toBe('NY');
  });

  it('preserves uppercase 2-letter codes', () => {
    expect(normalizeStateCode('ca')).toBe('CA');
    expect(normalizeStateCode('CA')).toBe('CA');
  });
});
