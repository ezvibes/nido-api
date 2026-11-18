import { describe, it, expect } from 'vitest';
import { normalizeRegionSlug, normalizeStateCode } from './state';

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

describe('client normalizeRegionSlug', () => {
  it('returns empty string for null, undefined, or whitespace inputs', () => {
    expect(normalizeRegionSlug(null)).toBe('');
    expect(normalizeRegionSlug(undefined)).toBe('');
    expect(normalizeRegionSlug('')).toBe('');
    expect(normalizeRegionSlug('   ')).toBe('');
  });

  it('normalizes full US state names and codes to lowercase state slugs', () => {
    expect(normalizeRegionSlug('North Carolina')).toBe('nc');
    expect(normalizeRegionSlug('  north-carolina  ')).toBe('nc');
    expect(normalizeRegionSlug('NC')).toBe('nc');
    expect(normalizeRegionSlug('nc')).toBe('nc');
    expect(normalizeRegionSlug('New York')).toBe('ny');
  });

  it('preserves non-state region names as lowercase hyphenated slugs', () => {
    expect(normalizeRegionSlug('Triangle')).toBe('triangle');
    expect(normalizeRegionSlug('Research Triangle')).toBe('research-triangle');
  });
});
