import {
  NewsletterDistributionAuditorService,
  NCRegion,
} from './newsletter-distribution-auditor.service';

describe('NewsletterDistributionAuditorService', () => {
  let service: NewsletterDistributionAuditorService;

  beforeEach(() => {
    service = new NewsletterDistributionAuditorService();
  });

  describe('resolveRegion', () => {
    it('should resolve Triangle cities correctly', () => {
      expect(service.resolveRegion('Raleigh')).toBe(NCRegion.TRIANGLE);
      expect(service.resolveRegion('Durham')).toBe(NCRegion.TRIANGLE);
      expect(service.resolveRegion('Carrboro')).toBe(NCRegion.TRIANGLE);
      expect(service.resolveRegion(undefined, "Cat's Cradle")).toBe(
        NCRegion.TRIANGLE,
      );
    });

    it('should resolve Western NC / Mountains cities correctly', () => {
      expect(service.resolveRegion('Asheville')).toBe(
        NCRegion.WESTERN_NC_MOUNTAINS,
      );
      expect(service.resolveRegion('Boone')).toBe(
        NCRegion.WESTERN_NC_MOUNTAINS,
      );
      expect(service.resolveRegion(undefined, 'The Orange Peel')).toBe(
        NCRegion.WESTERN_NC_MOUNTAINS,
      );
    });

    it('should resolve Coastal NC correctly', () => {
      expect(service.resolveRegion('Wilmington')).toBe(NCRegion.COASTAL_NC);
      expect(service.resolveRegion('Wrightsville Beach')).toBe(
        NCRegion.COASTAL_NC,
      );
      expect(service.resolveRegion(undefined, 'Greenfield Lake Amphitheater')).toBe(
        NCRegion.COASTAL_NC,
      );
    });

    it('should resolve Charlotte & Piedmont correctly', () => {
      expect(service.resolveRegion('Charlotte')).toBe(
        NCRegion.CHARLOTTE_PIEDMONT,
      );
      expect(service.resolveRegion('Greensboro')).toBe(
        NCRegion.CHARLOTTE_PIEDMONT,
      );
      expect(service.resolveRegion('Winston-Salem')).toBe(
        NCRegion.CHARLOTTE_PIEDMONT,
      );
      expect(service.resolveRegion(undefined, 'The Ramkat')).toBe(
        NCRegion.CHARLOTTE_PIEDMONT,
      );
    });

    it('should fallback to OTHER_REGIONAL for unmatched areas', () => {
      expect(service.resolveRegion('Richmond', 'The National')).toBe(
        NCRegion.OTHER_REGIONAL,
      );
    });
  });

  describe('mapToCanonicalGenre', () => {
    it('should categorize genres into canonical buckets', () => {
      expect(service.mapToCanonicalGenre('Psychedelic Jam Rock')).toBe('Jam');
      expect(service.mapToCanonicalGenre('Traditional Bluegrass')).toBe(
        'Bluegrass/Roots',
      );
      expect(service.mapToCanonicalGenre('Americana / Folk')).toBe(
        'Bluegrass/Roots',
      );
      expect(service.mapToCanonicalGenre('Deep Funk & Soul')).toBe('Funk/Soul');
      expect(service.mapToCanonicalGenre('Roots Reggae Dub')).toBe('Reggae');
      expect(service.mapToCanonicalGenre('Cosmic Country')).toBe('Alt-Country');
      expect(service.mapToCanonicalGenre('Heavy Metal')).toBe('Other');
    });
  });

  describe('auditDistribution', () => {
    it('should report gaps when certain NC hubs or genres are missing', () => {
      const events = [
        {
          artistName: 'Big Something',
          venueName: 'Lincoln Theatre',
          city: 'Raleigh',
          genres: ['Jam'],
        },
        {
          artistName: 'Dr. Bacon',
          venueName: 'The Pour House',
          city: 'Raleigh',
          genres: ['Funk'],
        },
      ];

      const report = service.auditDistribution(events);

      expect(report.totalEvents).toBe(2);
      expect(report.isBalanced).toBe(false);
      expect(report.underrepresentedRegions).toContain(
        NCRegion.WESTERN_NC_MOUNTAINS,
      );
      expect(report.underrepresentedRegions).toContain(NCRegion.COASTAL_NC);
      expect(report.underrepresentedRegions).toContain(
        NCRegion.CHARLOTTE_PIEDMONT,
      );
      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.scoutingRecommendations.length).toBeGreaterThan(0);
    });

    it('should mark balanced when all monitored regions are covered', () => {
      const events = [
        {
          artistName: 'Big Something',
          venueName: 'Lincoln Theatre',
          city: 'Raleigh',
          genres: ['Jam'],
        },
        {
          artistName: 'Dogs in a Pile',
          venueName: 'The Orange Peel',
          city: 'Asheville',
          genres: ['Jam'],
        },
        {
          artistName: 'Signal Fire',
          venueName: 'Greenfield Lake Amphitheater',
          city: 'Wilmington',
          genres: ['Reggae'],
        },
        {
          artistName: 'The Ramkat Allstars',
          venueName: 'The Ramkat',
          city: 'Winston-Salem',
          genres: ['Bluegrass'],
        },
      ];

      const report = service.auditDistribution(events);

      expect(report.underrepresentedRegions).toHaveLength(0);
      expect(report.regionBreakdown[NCRegion.TRIANGLE].count).toBe(1);
      expect(
        report.regionBreakdown[NCRegion.WESTERN_NC_MOUNTAINS].count,
      ).toBe(1);
      expect(report.regionBreakdown[NCRegion.COASTAL_NC].count).toBe(1);
      expect(
        report.regionBreakdown[NCRegion.CHARLOTTE_PIEDMONT].count,
      ).toBe(1);
    });
  });
});
