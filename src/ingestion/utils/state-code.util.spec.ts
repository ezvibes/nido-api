import { normalizeStateCode } from './state-code.util';

describe('normalizeStateCode', () => {
  it('defaults to NC when value is null, undefined, or empty string', () => {
    expect(normalizeStateCode(null)).toBe('NC');
    expect(normalizeStateCode(undefined)).toBe('NC');
    expect(normalizeStateCode('')).toBe('NC');
    expect(normalizeStateCode('   ')).toBe('NC');
  });

  it('normalizes North Carolina variants to NC', () => {
    expect(normalizeStateCode('North Carolina')).toBe('NC');
    expect(normalizeStateCode('north carolina')).toBe('NC');
    expect(normalizeStateCode('NORTH CAROLINA')).toBe('NC');
    expect(normalizeStateCode('  North Carolina  ')).toBe('NC');
    expect(normalizeStateCode('nc')).toBe('NC');
    expect(normalizeStateCode('NC')).toBe('NC');
    expect(normalizeStateCode(' nc ')).toBe('NC');
  });

  it('normalizes other state names to their 2-letter codes', () => {
    expect(normalizeStateCode('Virginia')).toBe('VA');
    expect(normalizeStateCode('virginia')).toBe('VA');
    expect(normalizeStateCode('South Carolina')).toBe('SC');
    expect(normalizeStateCode('New York')).toBe('NY');
    expect(normalizeStateCode('California')).toBe('CA');
    expect(normalizeStateCode('District of Columbia')).toBe('DC');
  });

  it('preserves existing valid 2-letter state codes in uppercase', () => {
    expect(normalizeStateCode('va')).toBe('VA');
    expect(normalizeStateCode('ny')).toBe('NY');
    expect(normalizeStateCode('CA')).toBe('CA');
  });

  it('falls back to custom fallback or default NC for unrecognized strings', () => {
    expect(normalizeStateCode('Unknown Land')).toBe('NC');
    expect(normalizeStateCode('Unknown Land', 'VA')).toBe('VA');
  });
});
