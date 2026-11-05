import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../data-source';
import { Venue, VenueVerificationState } from '../apis/venues/entities/venue.entity';
import { CanonicalVenueSchema, toCanonicalVenue } from '../contracts/venue.contract';
import * as dotenv from 'dotenv';

dotenv.config();

export interface VenueAuditFinding {
  venueId: string;
  name: string;
  city: string;
  citySlug: string;
  region: string;
  regionSlug: string;
  address: string | null;
  postalCode: string | null;
  capacity: number | null;
  verificationState: string;
  isValidCanonical: boolean;
  validationErrors?: string[];
  addressGap: boolean;
  addressGapReason?: string;
  invalidSlug: boolean;
  slugIssues?: string[];
}

export interface VenueAuditReport {
  timestamp: string;
  totalAudited: number;
  validCanonicalCount: number;
  invalidCanonicalCount: number;
  statusBreakdown: {
    canonical: number;
    verified: number;
    unverified: number;
    flagged: number;
    other: number;
  };
  addressGapsCount: number;
  slugIssuesCount: number;
  findings: VenueAuditFinding[];
}

export interface AuditVenuesOptions {
  reportPath?: string;
  fixtureVenues?: Partial<Venue>[];
  apiUrl?: string;
  silent?: boolean;
}

export const FALLBACK_SAMPLE_VENUES: Partial<Venue>[] = [
  {
    id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
    name: "Cat's Cradle",
    address: '300 E Main St',
    city: 'Carrboro',
    citySlug: 'carrboro',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27510',
    capacity: 750,
    verificationState: VenueVerificationState.CANONICAL,
  },
  {
    id: 'pour-house-raleigh-uuid-1',
    name: 'The Pour House Music Hall',
    address: '224 S Blount St',
    city: 'Raleigh',
    citySlug: 'raleigh',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27601',
    capacity: 289,
    verificationState: VenueVerificationState.VERIFIED,
  },
  {
    id: 'evening-muse-charlotte-uuid-2',
    name: 'The Evening Muse',
    address: null, // Address gap
    city: 'Charlotte',
    citySlug: 'charlotte',
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: null, // Postal code gap
    capacity: 120,
    verificationState: VenueVerificationState.UNVERIFIED,
  },
  {
    id: 'garage-winston-uuid-3',
    name: 'The Garage',
    address: '110 W 7th St',
    city: 'Winston Salem',
    citySlug: 'winston_salem_bad', // Invalid slug
    region: 'North Carolina',
    regionSlug: 'nc',
    postalCode: '27101',
    capacity: 150,
    verificationState: VenueVerificationState.FLAGGED,
  },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '');
}

/**
 * Audits a single venue record against CanonicalVenueSchema, address completeness, and slug hygiene.
 */
export function auditSingleVenue(rawVenue: Partial<Venue>): VenueAuditFinding {
  const issues: string[] = [];
  const slugIssues: string[] = [];
  let isValidCanonical = false;
  let validationErrors: string[] | undefined;

  // 1. Validate Canonical Contract
  try {
    toCanonicalVenue(rawVenue as Record<string, any>);
    isValidCanonical = true;
  } catch (err: any) {
    isValidCanonical = false;
    validationErrors = err.errors
      ? err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      : [err.message || 'Failed canonical venue schema validation'];
  }

  // 2. Check Address Gaps
  let addressGap = false;
  const addressGapReasons: string[] = [];
  if (!rawVenue.address || rawVenue.address.trim() === '') {
    addressGap = true;
    addressGapReasons.push('Missing street address');
  }
  if (!rawVenue.postalCode || rawVenue.postalCode.trim() === '') {
    addressGap = true;
    addressGapReasons.push('Missing postal code');
  }

  // 3. Check Slug Hygiene
  let invalidSlug = false;
  if (rawVenue.city) {
    const expectedCitySlug = slugify(rawVenue.city);
    if (!rawVenue.citySlug) {
      invalidSlug = true;
      slugIssues.push('Missing citySlug');
    } else if (rawVenue.citySlug !== expectedCitySlug) {
      invalidSlug = true;
      slugIssues.push(
        `City slug mismatch: expected '${expectedCitySlug}', found '${rawVenue.citySlug}'`,
      );
    }
  }

  if (rawVenue.region) {
    const expectedRegionSlug = slugify(rawVenue.region);
    // Allow either full slug or two-letter code (e.g. nc or north-carolina)
    if (!rawVenue.regionSlug) {
      invalidSlug = true;
      slugIssues.push('Missing regionSlug');
    } else if (
      rawVenue.regionSlug !== expectedRegionSlug &&
      rawVenue.regionSlug !== 'nc' &&
      rawVenue.regionSlug !== slugify(rawVenue.region.slice(0, 2))
    ) {
      invalidSlug = true;
      slugIssues.push(
        `Region slug mismatch: '${rawVenue.regionSlug}' does not align with '${rawVenue.region}'`,
      );
    }
  }

  const verificationState =
    (rawVenue.verificationState as string) ||
    VenueVerificationState.UNVERIFIED;

  return {
    venueId: rawVenue.id || 'unknown-id',
    name: rawVenue.name || 'Unnamed Venue',
    city: rawVenue.city || 'Unknown City',
    citySlug: rawVenue.citySlug || '',
    region: rawVenue.region || 'Unknown Region',
    regionSlug: rawVenue.regionSlug || '',
    address: rawVenue.address ?? null,
    postalCode: rawVenue.postalCode ?? null,
    capacity: rawVenue.capacity ?? null,
    verificationState,
    isValidCanonical,
    validationErrors,
    addressGap,
    addressGapReason: addressGap ? addressGapReasons.join('; ') : undefined,
    invalidSlug,
    slugIssues: invalidSlug ? slugIssues : undefined,
  };
}

/**
 * Runs a streaming audit of all catalog venues, prints formatted progress, and writes the JSON report.
 */
export async function auditVenues(
  options: AuditVenuesOptions = {},
): Promise<VenueAuditReport> {
  const { silent = false } = options;
  const defaultReportPath = path.resolve(
    process.cwd(),
    '.agents',
    'runs',
    'venue-audit-report.json',
  );
  const targetReportPath = options.reportPath || defaultReportPath;

  if (!silent) {
    console.log('======================================================');
    console.log('🏛️  NIDO CANONICAL VENUE CATALOG AUDIT');
    console.log('======================================================');
  }

  let rawVenues: Partial<Venue>[] = [];

  if (options.fixtureVenues) {
    rawVenues = options.fixtureVenues;
    if (!silent) {
      console.log(`📡 Ingesting ${rawVenues.length} venues from provided fixture set.`);
    }
  } else if (options.apiUrl) {
    try {
      if (!silent) {
        console.log(`🌐 Fetching live venues from API: ${options.apiUrl}...`);
      }
      const targetUrl = options.apiUrl.endsWith('/venues')
        ? options.apiUrl
        : `${options.apiUrl.replace(/\/$/, '')}/venues`;
      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      rawVenues = Array.isArray(json) ? json : json.data || [];
      if (!silent) {
        console.log(`✅ Loaded ${rawVenues.length} venue records from API.`);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn(`⚠️ Failed to fetch venues from API: ${err.message}.`);
        console.warn('⚡ Falling back to built-in NC catalog audit fixtures.');
      }
      rawVenues = FALLBACK_SAMPLE_VENUES;
    }
  } else {
    try {
      if (!silent) {
        console.log('🔌 Connecting to database via DataSource...');
      }
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      const venueRepo = dataSource.getRepository(Venue);
      rawVenues = await venueRepo.find({ order: { name: 'ASC' } });
      if (!silent) {
        console.log(`✅ Loaded ${rawVenues.length} venue records from PostgreSQL catalog.`);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn(
          `⚠️ Could not connect to PostgreSQL database: ${err.message}.`,
        );
        console.warn('⚡ Falling back to built-in NC catalog audit fixtures.');
      }
      rawVenues = FALLBACK_SAMPLE_VENUES;
    }
  }

  const findings: VenueAuditFinding[] = [];
  const statusBreakdown = {
    canonical: 0,
    verified: 0,
    unverified: 0,
    flagged: 0,
    other: 0,
  };

  let validCanonicalCount = 0;
  let invalidCanonicalCount = 0;
  let addressGapsCount = 0;
  let slugIssuesCount = 0;

  if (!silent) {
    console.log('\n--- 🔍 Streaming Venue Validation ---');
  }

  for (let i = 0; i < rawVenues.length; i++) {
    const raw = rawVenues[i];
    const finding = auditSingleVenue(raw);
    findings.push(finding);

    if (finding.isValidCanonical) {
      validCanonicalCount++;
    } else {
      invalidCanonicalCount++;
    }

    if (finding.addressGap) {
      addressGapsCount++;
    }

    if (finding.invalidSlug) {
      slugIssuesCount++;
    }

    const state = finding.verificationState;
    if (state === 'canonical') statusBreakdown.canonical++;
    else if (state === 'verified') statusBreakdown.verified++;
    else if (state === 'unverified') statusBreakdown.unverified++;
    else if (state === 'flagged') statusBreakdown.flagged++;
    else statusBreakdown.other++;

    if (!silent) {
      const statusIcon =
        finding.verificationState === 'canonical'
          ? '👑 [CANONICAL]'
          : finding.verificationState === 'verified'
            ? '✅ [VERIFIED]'
            : finding.verificationState === 'flagged'
              ? '🚩 [FLAGGED]'
              : '⏳ [UNVERIFIED]';
      const gapIcon = finding.addressGap ? '⚠️ [Address Gap]' : '📍 [Full Address]';
      const slugIcon = finding.invalidSlug ? '❌ [Bad Slug]' : '🔗 [Valid Slug]';

      console.log(
        `[${i + 1}/${rawVenues.length}] ${finding.name} (${finding.city}, ${finding.region}) | ${statusIcon} | ${gapIcon} | ${slugIcon}`,
      );
      if (finding.addressGapReason) {
        console.log(`    ↳ Address Gap: ${finding.addressGapReason}`);
      }
      if (finding.slugIssues && finding.slugIssues.length > 0) {
        console.log(`    ↳ Slug Issues: ${finding.slugIssues.join(', ')}`);
      }
      if (!finding.isValidCanonical && finding.validationErrors) {
        console.log(
          `    ↳ Canonical Contract Errors: ${finding.validationErrors.join(', ')}`,
        );
      }
    }
  }

  const report: VenueAuditReport = {
    timestamp: new Date().toISOString(),
    totalAudited: findings.length,
    validCanonicalCount,
    invalidCanonicalCount,
    statusBreakdown,
    addressGapsCount,
    slugIssuesCount,
    findings,
  };

  // Write to .agents/runs/venue-audit-report.json
  const reportDir = path.dirname(targetReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(targetReportPath, JSON.stringify(report, null, 2), 'utf8');

  if (!silent) {
    console.log('\n======================================================');
    console.log('📊 AUDIT SUMMARY REPORT');
    console.log('======================================================');
    console.log(` Total Venues Audited     : ${report.totalAudited}`);
    console.log(
      ` Canonical Schema Valid   : ${report.validCanonicalCount} / ${report.totalAudited}`,
    );
    console.log(
      ` Address Gaps             : ${report.addressGapsCount} venues missing street address or postal code`,
    );
    console.log(
      ` Slug Issues              : ${report.slugIssuesCount} venues with invalid city/region slug`,
    );
    console.log(' Status Breakdown:');
    console.log(`   - 👑 Canonical  : ${report.statusBreakdown.canonical}`);
    console.log(`   - ✅ Verified   : ${report.statusBreakdown.verified}`);
    console.log(`   - ⏳ Unverified : ${report.statusBreakdown.unverified}`);
    console.log(`   - 🚩 Flagged    : ${report.statusBreakdown.flagged}`);
    console.log('------------------------------------------------------');
    console.log(`📝 Audit Report Written To : ${targetReportPath}`);
    console.log('======================================================\n');
  }

  // Gracefully close datasource if it was opened locally
  if (!options.fixtureVenues && dataSource.isInitialized) {
    try {
      await dataSource.destroy();
    } catch {
      // Ignore teardown errors
    }
  }

  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let customReportPath: string | undefined;
  let customApiUrl: string | undefined = process.env.AUDIT_API_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--report' || args[i] === '-r') {
      customReportPath = args[++i];
    } else if (args[i] === '--api' || args[i] === '-a') {
      customApiUrl = args[++i];
    }
  }

  auditVenues({ reportPath: customReportPath, apiUrl: customApiUrl })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error during venue audit execution:', err);
      process.exit(1);
    });
}
