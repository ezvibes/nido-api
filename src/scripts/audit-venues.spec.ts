import * as fs from 'fs';
import * as path from 'path';
import {
  auditSingleVenue,
  auditVenues,
  slugify,
  FALLBACK_SAMPLE_VENUES,
} from './audit-venues';
import { Venue, VenueVerificationState } from '../apis/venues/entities/venue.entity';

describe('Venue Catalog Audit CLI (audit:venues)', () => {
  const testReportDir = path.resolve(process.cwd(), '.agents', 'test-runs');
  const testReportPath = path.resolve(
    testReportDir,
    'venue-audit-test-report.json',
  );

  afterAll(() => {
    if (fs.existsSync(testReportPath)) {
      fs.unlinkSync(testReportPath);
    }
    if (fs.existsSync(testReportDir)) {
      try {
        fs.rmdirSync(testReportDir);
      } catch {
        // Ignore directory cleanup error
      }
    }
  });

  describe('slugify helper', () => {
    it('produces lowercase hyphenated slugs', () => {
      expect(slugify('Winston Salem')).toBe('winston-salem');
      expect(slugify("Cat's Cradle")).toBe('cats-cradle');
      expect(slugify('  North  Carolina  ')).toBe('north-carolina');
    });
  });

  describe('auditSingleVenue', () => {
    it('accurately audits a valid canonical venue with no gaps', () => {
      const fixture: Partial<Venue> = {
        id: 'venue-1',
        name: "Cat's Cradle",
        address: '300 E Main St',
        city: 'Carrboro',
        citySlug: 'carrboro',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '27510',
        capacity: 750,
        verificationState: VenueVerificationState.CANONICAL,
      };

      const finding = auditSingleVenue(fixture);

      expect(finding.isValidCanonical).toBe(true);
      expect(finding.addressGap).toBe(false);
      expect(finding.invalidSlug).toBe(false);
      expect(finding.verificationState).toBe('canonical');
    });

    it('identifies address gaps when address or postal code is missing', () => {
      const fixture: Partial<Venue> = {
        id: 'venue-gap',
        name: 'Gap Venue',
        address: null,
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: null,
        capacity: 200,
        verificationState: VenueVerificationState.UNVERIFIED,
      };

      const finding = auditSingleVenue(fixture);

      expect(finding.isValidCanonical).toBe(true);
      expect(finding.addressGap).toBe(true);
      expect(finding.addressGapReason).toContain('Missing street address');
      expect(finding.addressGapReason).toContain('Missing postal code');
      expect(finding.verificationState).toBe('unverified');
    });

    it('identifies invalid slugs when city or region slug is mismatched', () => {
      const fixture: Partial<Venue> = {
        id: 'venue-bad-slug',
        name: 'The Garage',
        address: '110 W 7th St',
        city: 'Winston Salem',
        citySlug: 'winston_bad_slug', // Should be winston-salem
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '27101',
        capacity: 150,
        verificationState: VenueVerificationState.FLAGGED,
      };

      const finding = auditSingleVenue(fixture);

      expect(finding.invalidSlug).toBe(true);
      expect(finding.slugIssues![0]).toContain('City slug mismatch');
      expect(finding.verificationState).toBe('flagged');
    });

    it('identifies schema contract failures when required properties are missing', () => {
      const invalidFixture: Partial<Venue> = {
        id: '', // Empty ID violates CanonicalVenueSchema
        name: '',
        city: '',
      };

      const finding = auditSingleVenue(invalidFixture);

      expect(finding.isValidCanonical).toBe(false);
      expect(finding.validationErrors).toBeDefined();
      expect(finding.validationErrors!.length).toBeGreaterThan(0);
    });
  });

  describe('auditVenues streaming execution & report writing', () => {
    it('executes streaming audit and writes structured JSON report to target destination', async () => {
      const report = await auditVenues({
        reportPath: testReportPath,
        fixtureVenues: FALLBACK_SAMPLE_VENUES,
        silent: true,
      });

      expect(report.totalAudited).toBe(FALLBACK_SAMPLE_VENUES.length);
      expect(report.validCanonicalCount).toBe(FALLBACK_SAMPLE_VENUES.length);
      expect(report.statusBreakdown.canonical).toBe(1);
      expect(report.statusBreakdown.verified).toBe(1);
      expect(report.statusBreakdown.unverified).toBe(1);
      expect(report.statusBreakdown.flagged).toBe(1);
      expect(report.addressGapsCount).toBeGreaterThan(0);
      expect(report.slugIssuesCount).toBeGreaterThan(0);

      // Verify JSON report file was written
      expect(fs.existsSync(testReportPath)).toBe(true);
      const fileContent = JSON.parse(
        fs.readFileSync(testReportPath, 'utf8'),
      );
      expect(fileContent.totalAudited).toBe(report.totalAudited);
      expect(fileContent.findings).toHaveLength(report.totalAudited);
    });
  });
});
