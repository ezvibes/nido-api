import {
  findVenue,
  handleLookupCuratedVenue,
  handleProposeVenueEnrichment,
  proposeVenueEnrichmentTool,
  createMunchenVenueScoutAgent,
  VenueEnrichmentPatchSchema,
} from './test-adk-venue-scout';

describe('Munchen Venue Scout Agent & Non-Destructive Enrichment Tools', () => {
  describe('handleLookupCuratedVenue', () => {
    it('returns verified catalog details including postal code and capacity', async () => {
      const result = await handleLookupCuratedVenue({ name: "Cat's Cradle" });

      expect(result.found).toBe(true);
      expect(result.venueId).toBe('cats-cradle-carrboro');
      expect(result.name).toBe("Cat's Cradle");
      expect(result.postalCode).toBe('27510');
      expect(result.capacity).toBe(750);
      expect(result.verifiedStatus).toBe('VERIFIED');
    });

    it('returns UNVERIFIED status for unknown rooms without inventing data', async () => {
      const result = await handleLookupCuratedVenue({
        name: 'Nonexistent Underground Spot',
      });

      expect(result.found).toBe(false);
      expect(result.verifiedStatus).toBe('UNVERIFIED');
      expect(result.partnerTier).toContain('Unverified');
    });
  });

  describe('VenueEnrichmentPatchSchema', () => {
    it('validates a correct enrichment patch proposal', () => {
      const validPatch = {
        venueId: 'snug-harbor-charlotte',
        postalCode: '28205',
        capacity: 150,
        proposedVerificationState: 'verified' as const,
        evidenceSource: 'https://snugrock.com/about',
        confidence: 0.95,
        notes: 'Verified via official website and marquee inspection',
      };

      const parsed = VenueEnrichmentPatchSchema.parse(validPatch);
      expect(parsed).toEqual(validPatch);
    });

    it('rejects invalid patch with negative capacity or confidence > 1.0', () => {
      expect(() =>
        VenueEnrichmentPatchSchema.parse({
          venueId: 'test-room',
          capacity: -10,
          evidenceSource: 'Notes',
          confidence: 0.8,
        }),
      ).toThrow();

      expect(() =>
        VenueEnrichmentPatchSchema.parse({
          venueId: 'test-room',
          evidenceSource: 'Notes',
          confidence: 1.5,
        }),
      ).toThrow();
    });
  });

  describe('handleProposeVenueEnrichment', () => {
    it('generates a non-destructive proposal that flags human review requirement', async () => {
      const proposal = await handleProposeVenueEnrichment({
        venueId: 'unverified-room-123',
        postalCode: '27601',
        capacity: 350,
        proposedVerificationState: 'verified',
        evidenceSource: 'Local Scout Marquee Check',
        confidence: 0.9,
        notes: 'Human review required before promotion',
      });

      expect(proposal.proposalId).toBeDefined();
      expect(proposal.venueId).toBe('unverified-room-123');
      expect(proposal.patch.postalCode).toBe('27601');
      expect(proposal.patch.capacity).toBe(350);
      expect(proposal.patch.verificationState).toBe('verified');
      expect(proposal.humanReviewRequired).toBe(true);
      expect(proposal.status).toBe('proposed_for_review');
    });
  });

  describe('createMunchenVenueScoutAgent', () => {
    it('registers proposeVenueEnrichmentTool in agent tools list', () => {
      const mockDataSource = {};
      const agent = createMunchenVenueScoutAgent(mockDataSource);

      const toolNames = agent.tools.map((t: any) => t.name);
      expect(toolNames).toContain('lookupCuratedVenue');
      expect(toolNames).toContain('getUpcomingShowsAtVenue');
      expect(toolNames).toContain('proposeVenueEnrichment');
    });
  });
});
