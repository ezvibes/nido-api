import { inferTimezoneFromLocation } from './timezone-lookup.util';

describe('timezone-lookup.util', () => {
  it('infers America/New_York for North Carolina and Eastern states', () => {
    expect(inferTimezoneFromLocation('NC')).toBe('America/New_York');
    expect(inferTimezoneFromLocation('ny')).toBe('America/New_York');
    expect(inferTimezoneFromLocation(undefined, 'Raleigh')).toBe('America/New_York');
  });

  it('infers America/Chicago for Central states and cities', () => {
    expect(inferTimezoneFromLocation('IL')).toBe('America/Chicago');
    expect(inferTimezoneFromLocation('TX')).toBe('America/Chicago');
    expect(inferTimezoneFromLocation(undefined, 'Chicago')).toBe('America/Chicago');
  });

  it('infers America/Denver or America/Phoenix for Mountain states', () => {
    expect(inferTimezoneFromLocation('CO')).toBe('America/Denver');
    expect(inferTimezoneFromLocation('AZ')).toBe('America/Phoenix');
  });

  it('infers America/Los_Angeles for Pacific states', () => {
    expect(inferTimezoneFromLocation('CA')).toBe('America/Los_Angeles');
    expect(inferTimezoneFromLocation('WA')).toBe('America/Los_Angeles');
  });

  it('returns null when location is unknown', () => {
    expect(inferTimezoneFromLocation(null, null)).toBeNull();
    expect(inferTimezoneFromLocation('ZZ', 'Nowhere')).toBeNull();
  });
});
