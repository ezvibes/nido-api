/**
 * Deterministic IANA timezone inference for concert locations.
 */

const STATE_TO_TIMEZONE: Record<string, string> = {
  // Eastern
  CT: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  IN: 'America/New_York',
  KY: 'America/New_York',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/New_York',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NY: 'America/New_York',
  NC: 'America/New_York',
  OH: 'America/New_York',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  TN: 'America/New_York',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WV: 'America/New_York',
  DC: 'America/New_York',

  // Central
  AL: 'America/Chicago',
  AR: 'America/Chicago',
  IL: 'America/Chicago',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  LA: 'America/Chicago',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  NE: 'America/Chicago',
  ND: 'America/Chicago',
  OK: 'America/Chicago',
  SD: 'America/Chicago',
  TX: 'America/Chicago',
  WI: 'America/Chicago',

  // Mountain
  AZ: 'America/Phoenix',
  CO: 'America/Denver',
  ID: 'America/Denver',
  MT: 'America/Denver',
  NM: 'America/Denver',
  UT: 'America/Denver',
  WY: 'America/Denver',

  // Pacific
  CA: 'America/Los_Angeles',
  NV: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',

  // AK & HI
  AK: 'America/Anchorage',
  HI: 'Pacific/Honolulu',
};

const CITY_OVERRIDE_TO_TIMEZONE: Record<string, string> = {
  raleigh: 'America/New_York',
  durham: 'America/New_York',
  'chapel hill': 'America/New_York',
  charlotte: 'America/New_York',
  asheville: 'America/New_York',
  greensboro: 'America/New_York',
  wilmington: 'America/New_York',
  atlanta: 'America/New_York',
  'new york': 'America/New_York',
  brooklyn: 'America/New_York',
  philadelphia: 'America/New_York',
  boston: 'America/New_York',
  chicago: 'America/Chicago',
  austin: 'America/Chicago',
  nashville: 'America/Chicago',
  memphis: 'America/Chicago',
  denver: 'America/Denver',
  boulder: 'America/Denver',
  phoenix: 'America/Phoenix',
  'los angeles': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  portland: 'America/Los_Angeles',
};

/**
 * Infer IANA timezone from state code (2-letter) or city name.
 */
export function inferTimezoneFromLocation(
  state?: string | null,
  city?: string | null,
): string | null {
  if (state) {
    const cleanState = state.trim().toUpperCase();
    if (STATE_TO_TIMEZONE[cleanState]) {
      return STATE_TO_TIMEZONE[cleanState];
    }
  }

  if (city) {
    const cleanCity = city.trim().toLowerCase();
    if (CITY_OVERRIDE_TO_TIMEZONE[cleanCity]) {
      return CITY_OVERRIDE_TO_TIMEZONE[cleanCity];
    }
  }

  return null;
}
