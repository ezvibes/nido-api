import { z } from 'zod';
import {
  CanonicalVenueSchema,
  toCanonicalVenue,
  CanonicalBandSchema,
  toCanonicalBand,
  CanonicalConcertSchema,
  toCanonicalConcert,
  PosterExtractionResultSchema,
  validatePosterExtractionResult,
  CloudTasksWorkerPayloadSchema,
  validateCloudTasksPayload,
  CuratedNewsletterCardSchema,
  toCuratedNewsletterCard,
  toGeminiJsonSchema,
  GEMINI_SCHEMA_ADAPTER_VERSION,
} from '../../src/contracts';

describe('Centralized Runtime Contract Matrix', () => {
  describe('CanonicalVenueSchema & toCanonicalVenue', () => {
    it('validates a complete canonical venue fixture', () => {
      const fixture = {
        id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        name: "Cat's Cradle",
        address: '300 E Main St',
        city: 'Carrboro',
        state: 'NC',
        postalCode: '27510',
        capacity: 750,
        verificationState: 'canonical' as const,
      };

      const parsed = CanonicalVenueSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
    });

    it('maps TypeORM Venue entity non-destructively without inventing fake defaults', () => {
      const typeOrmEntity = Object.freeze({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'The Cradle Back Room',
        address: '300 E Main St',
        city: 'Carrboro',
        citySlug: 'carrboro',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      });

      const canonical = toCanonicalVenue(typeOrmEntity);

      expect(canonical.id).toBe(typeOrmEntity.id);
      expect(canonical.name).toBe(typeOrmEntity.name);
      expect(canonical.city).toBe('Carrboro');
      expect(canonical.state).toBe('NC');
      expect(canonical.address).toBe('300 E Main St');
      expect(canonical.capacity).toBeNull();
      expect(canonical.postalCode).toBeNull();
      expect(canonical.verificationState).toBeNull();

      // Non-destructive: source entity is untouched
      expect(typeOrmEntity).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'The Cradle Back Room',
        address: '300 E Main St',
        city: 'Carrboro',
        citySlug: 'carrboro',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      });
    });

    it('rejects venue with missing required properties or invalid types', () => {
      const missingCity = {
        id: '123',
        name: 'Test Venue',
        state: 'NC',
      };
      expect(() => CanonicalVenueSchema.parse(missingCity)).toThrow(z.ZodError);

      const invalidCapacity = {
        id: '123',
        name: 'Test Venue',
        city: 'Carrboro',
        state: 'NC',
        capacity: -10,
      };
      expect(() => CanonicalVenueSchema.parse(invalidCapacity)).toThrow(z.ZodError);
    });
  });

  describe('CanonicalBandSchema & toCanonicalBand', () => {
    it('validates a complete canonical band fixture', () => {
      const fixture = {
        id: 'band-uuid-001',
        name: 'Chatham County Line',
        genres: ['Bluegrass', 'Americana'],
      };

      const parsed = CanonicalBandSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
    });

    it('maps TypeORM Band entity non-destructively without mutating source entity', () => {
      const typeOrmBand = Object.freeze({
        id: 'band-uuid-002',
        name: 'Mipso',
        slug: 'mipso',
        genres: ['Folk', 'Indie'],
        isFeatured: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      });

      const canonical = toCanonicalBand(typeOrmBand);

      expect(canonical.id).toBe('band-uuid-002');
      expect(canonical.name).toBe('Mipso');
      expect(canonical.genres).toEqual(['Folk', 'Indie']);

      // Verify no mutation
      expect(typeOrmBand.name).toBe('Mipso');
    });

    it('rejects band with missing required properties', () => {
      expect(() =>
        CanonicalBandSchema.parse({
          id: 'b1',
        }),
      ).toThrow(z.ZodError);

      expect(() =>
        CanonicalBandSchema.parse({
          name: 'Band without ID',
        }),
      ).toThrow(z.ZodError);
    });
  });

  describe('CanonicalConcertSchema & toCanonicalConcert', () => {
    it('validates a full canonical concert fixture', () => {
      const fixture = {
        id: 'concert-uuid-999',
        title: 'NC Mountain Music Showcase',
        venue: {
          id: 'venue-uuid-1',
          name: "Cat's Cradle",
          city: 'Carrboro',
          state: 'NC',
        },
        lineup: [
          {
            band: {
              id: 'band-1',
              name: 'Chatham County Line',
            },
            role: 'headliner' as const,
            order: 0,
            setTime: '21:00',
          },
          {
            band: {
              id: 'band-2',
              name: 'Mipso',
            },
            role: 'support' as const,
            order: 1,
            setTime: '19:30',
          },
        ],
        localEventDate: '2026-10-31',
        startTime: '20:00:00',
        doorTime: '19:00:00',
        ticketUrl: 'https://catscradle.com/event/12345',
        ageRestriction: 'All Ages',
        catalogStatus: 'active' as const,
        isAdminApproved: true,
      };

      const parsed = CanonicalConcertSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
    });

    it('maps TypeORM Concert entity with relations non-destructively', () => {
      const typeOrmConcert = Object.freeze({
        id: 'c-100',
        title: 'Autumn Roots Gathering',
        genre: 'Bluegrass',
        startsAt: new Date('2026-11-15T20:30:00.000Z'),
        catalogStatus: 'active',
        isAdminApproved: true,
        venue: {
          id: 'v-100',
          name: 'Lincoln Theatre',
          city: 'Raleigh',
          region: 'NC',
        },
        lineup: [
          {
            performanceOrder: 1,
            performanceRole: 'support',
            band: { id: 'b-2', name: 'Opener Band' },
          },
          {
            performanceOrder: 0,
            performanceRole: 'headliner',
            band: { id: 'b-1', name: 'Main Act' },
          },
        ],
        description: 'Join us! Tickets available at https://lincolntheatre.com/tix/123',
      });

      const canonical = toCanonicalConcert(typeOrmConcert);

      expect(canonical.id).toBe('c-100');
      expect(canonical.title).toBe('Autumn Roots Gathering');
      expect(canonical.venue.name).toBe('Lincoln Theatre');
      expect(canonical.venue.state).toBe('NC');
      expect(canonical.localEventDate).toBe('2026-11-15');
      expect(canonical.startTime).toBe('20:30:00');
      expect(canonical.ticketUrl).toBe('https://lincolntheatre.com/tix/123');
      expect(canonical.lineup).toHaveLength(2);
      expect(canonical.lineup[0].band.name).toBe('Main Act');
      expect(canonical.lineup[0].role).toBe('headliner');
      expect(canonical.lineup[0].order).toBe(0);
      expect(canonical.lineup[1].band.name).toBe('Opener Band');
      expect(canonical.lineup[1].role).toBe('support');
      expect(canonical.lineup[1].order).toBe(1);

      // Verify no mutation of source entity
      expect(typeOrmConcert.title).toBe('Autumn Roots Gathering');
    });

    it('rejects malformed date or time formats', () => {
      const invalidDate = {
        id: 'c-1',
        title: 'Show',
        venue: { id: 'v1', name: 'Venue', city: 'City', state: 'ST' },
        lineup: [],
        localEventDate: '10/31/2026', // invalid: must be YYYY-MM-DD
        startTime: '20:00:00',
      };
      expect(() => CanonicalConcertSchema.parse(invalidDate)).toThrow(z.ZodError);

      const invalidTime = {
        id: 'c-1',
        title: 'Show',
        venue: { id: 'v1', name: 'Venue', city: 'City', state: 'ST' },
        lineup: [],
        localEventDate: '2026-10-31',
        startTime: '8:00 PM', // invalid: must be HH:MM or HH:MM:SS
      };
      expect(() => CanonicalConcertSchema.parse(invalidTime)).toThrow(z.ZodError);
    });
  });

  describe('PosterExtractionResultSchema & Gemini Extraction Validation', () => {
    it('validates a complete poster extraction result fixture', () => {
      const fixture = {
        title: 'Carolina Music Festival',
        venue: {
          name: "Cat's Cradle Back Room",
          city: 'Carrboro',
          state: 'NC',
        },
        performers: [
          { name: 'Chatham County Line', isHeadliner: true, setTime: '21:00', stage: 'Main Stage' },
          { name: 'Mipso', isHeadliner: false, setTime: '19:30', stage: 'Acoustic Stage' },
        ],
        dates: [
          {
            date: '2026-10-15',
            doorsTime: '18:00:00',
            startTime: '19:00:00',
            timezone: 'America/New_York',
            warning: "Hint conflict: uploader suggested '2026-10-16', poster states '2026-10-15'",
          },
        ],
        primaryGenre: 'Bluegrass',
        genres: ['Bluegrass', 'Folk', 'Americana'],
        isFestival: true,
        ticketPrice: '$25 ADV / $30 DOS',
        ageRestriction: 'All Ages',
        promotersAndSponsors: ["Cat's Cradle Presents", 'WUNC Radio'],
        rawOcrText: 'CAROLINA MUSIC FESTIVAL OCT 15 CATS CRADLE DOORS 6PM SHOW 7PM',
        confidence: 0.95,
        warnings: ["Hint conflict: uploader suggested '2026-10-16', poster states '2026-10-15'"],
      };

      const validated = validatePosterExtractionResult(fixture);
      expect(validated.title).toBe('Carolina Music Festival');
      expect(validated.dates![0].warning).toContain('Hint conflict');
      expect(validated.performers).toHaveLength(2);
    });

    it('rejects malformed dates or out-of-range confidence scores', () => {
      const malformedDate = {
        title: 'Broken Date Show',
        dates: [{ date: 'not-a-date' }],
      };
      expect(() => validatePosterExtractionResult(malformedDate)).toThrow(z.ZodError);

      const invalidConfidence = {
        title: 'Broken Confidence',
        confidence: 1.5, // > 1.0
      };
      expect(() => validatePosterExtractionResult(invalidConfidence)).toThrow(z.ZodError);

      const missingPerformerName = {
        performers: [{ name: '', isHeadliner: true }],
      };
      expect(() => validatePosterExtractionResult(missingPerformerName)).toThrow(z.ZodError);
    });
  });

  describe('CloudTasksWorkerPayloadSchema & Strict Payload Validation', () => {
    it('accepts a valid strictly-typed Cloud Tasks worker payload', () => {
      const payload = {
        jobId: '8f96ce70-4e5a-4b95-a2f0-5197825d1e2e',
        attempt: 1,
      };

      const validated = validateCloudTasksPayload(payload);
      expect(validated).toEqual(payload);
    });

    it('rejects payload with invalid UUID', () => {
      const badUuid = {
        jobId: 'job-1234-invalid',
        attempt: 1,
      };
      expect(() => validateCloudTasksPayload(badUuid)).toThrow(z.ZodError);
    });

    it('rejects payload with out-of-bounds or non-integer attempt', () => {
      const zeroAttempt = {
        jobId: '8f96ce70-4e5a-4b95-a2f0-5197825d1e2e',
        attempt: 0,
      };
      expect(() => validateCloudTasksPayload(zeroAttempt)).toThrow(z.ZodError);

      const floatAttempt = {
        jobId: '8f96ce70-4e5a-4b95-a2f0-5197825d1e2e',
        attempt: 2.5,
      };
      expect(() => validateCloudTasksPayload(floatAttempt)).toThrow(z.ZodError);

      const exceededAttempt = {
        jobId: '8f96ce70-4e5a-4b95-a2f0-5197825d1e2e',
        attempt: 30, // exceeds max 25
      };
      expect(() => validateCloudTasksPayload(exceededAttempt)).toThrow(z.ZodError);
    });

    it('strictly rejects payloads containing extra unexpected properties', () => {
      const extraProp = {
        jobId: '8f96ce70-4e5a-4b95-a2f0-5197825d1e2e',
        attempt: 1,
        maliciousField: 'exploit',
      };
      expect(() => validateCloudTasksPayload(extraProp)).toThrow(z.ZodError);
    });
  });

  describe('CuratedNewsletterCardSchema & toCuratedNewsletterCard', () => {
    it('creates a CuratedNewsletterCard referencing canonical IDs without mutating catalog fixtures', () => {
      const canonicalConcert = Object.freeze({
        id: 'concert-fixture-funk',
        title: 'Fixture Funk Night',
        genre: 'Funk',
        localEventDate: '2026-11-14',
        startTime: '20:00:00',
        ticketUrl: 'https://tickets.example.invalid/funk',
        venue: Object.freeze({
          id: 'venue-fixture-raleigh',
          name: 'Fixture Raleigh Room',
          city: 'Raleigh',
          state: 'NC',
        }),
        lineup: Object.freeze([
          Object.freeze({
            band: Object.freeze({
              id: 'band-fixture-funk',
              name: 'Fixture Funk Band',
            }),
            role: 'headliner' as const,
            order: 0,
          }),
        ]),
      });

      const editorialBlurb = 'The Triangle groove event of the season.';
      const card = toCuratedNewsletterCard(
        canonicalConcert as any,
        editorialBlurb,
      );

      expect(card.headline).toBe('Fixture Funk Night');
      expect(card.editorialBlurb).toBe(editorialBlurb);
      expect(card.ticketLink).toBe('https://tickets.example.invalid/funk');
      expect(card.canonicalEntityIds).toEqual({
        concertId: 'concert-fixture-funk',
        venueId: 'venue-fixture-raleigh',
        bandIds: ['band-fixture-funk'],
      });

      // Verify no mutation of catalog source
      expect(canonicalConcert.id).toBe('concert-fixture-funk');
    });

    it('rejects card with missing headline or editorial blurb', () => {
      const invalidCard = {
        headline: '',
        showDetails: 'Details',
        editorialBlurb: 'Blurb',
        canonicalEntityIds: { concertId: 'c1' },
      };
      expect(() => CuratedNewsletterCardSchema.parse(invalidCard)).toThrow(z.ZodError);
    });
  });

  describe('Gemini Schema Adapter (toGeminiJsonSchema)', () => {
    it('converts basic and nested Zod schemas to deterministic Gemini JSON Schema', () => {
      const sampleSchema = z.object({
        venueName: z.string().describe('Name of the venue'),
        capacity: z.number().int().optional(),
        isOutdoor: z.boolean(),
        genres: z.array(z.string()),
      });

      const geminiSchema = toGeminiJsonSchema(sampleSchema);

      expect(geminiSchema.type).toBe('OBJECT');
      expect(geminiSchema.required).toEqual(['genres', 'isOutdoor', 'venueName']); // sorted alphabetically
      expect(geminiSchema.properties!['capacity']).toEqual({ type: 'INTEGER' });
      expect(geminiSchema.properties!['isOutdoor']).toEqual({ type: 'BOOLEAN' });
      expect(geminiSchema.properties!['venueName']).toEqual({
        type: 'STRING',
        description: 'Name of the venue',
      });
      expect(geminiSchema.properties!['genres']).toEqual({
        type: 'ARRAY',
        items: { type: 'STRING' },
      });
    });

    it('produces deterministic output across multiple calls', () => {
      const schemaA = z.object({
        z_last: z.string(),
        a_first: z.number(),
        m_middle: z.boolean(),
      });

      const output1 = JSON.stringify(toGeminiJsonSchema(schemaA));
      const output2 = JSON.stringify(toGeminiJsonSchema(schemaA));

      expect(output1).toBe(output2);
      expect(Object.keys(toGeminiJsonSchema(schemaA).properties!)).toEqual([
        'a_first',
        'm_middle',
        'z_last',
      ]);
    });

    it('supports enum and unwrap modifiers (nullable, default, optional)', () => {
      const schema = z.object({
        status: z.enum(['pending', 'approved', 'rejected']),
        nullableCount: z.number().nullable(),
        defaultTag: z.string().default('general'),
      });

      const gemini = toGeminiJsonSchema(schema);
      expect(gemini.properties!['status']).toEqual({
        type: 'STRING',
        enum: ['approved', 'pending', 'rejected'], // sorted
      });
      expect(gemini.properties!['nullableCount']).toEqual({
        type: 'NUMBER',
        nullable: true,
      });
      expect(gemini.properties!['defaultTag']).toEqual({
        type: 'STRING',
      });
    });

    it('explicitly rejects unsupported Zod constructs', () => {
      expect(() => toGeminiJsonSchema(z.function() as any)).toThrow(
        /Unsupported Zod construct for Gemini schema conversion: function/,
      );
      expect(() => toGeminiJsonSchema(z.map(z.string(), z.string()) as any)).toThrow(
        /Unsupported Zod construct for Gemini schema conversion: map/,
      );
      expect(() => toGeminiJsonSchema(z.set(z.string()) as any)).toThrow(
        /Unsupported Zod construct for Gemini schema conversion: set/,
      );
      expect(() => toGeminiJsonSchema(z.promise(z.string()) as any)).toThrow(
        /Unsupported Zod construct for Gemini schema conversion: promise/,
      );
    });

    it('reports the correct version', () => {
      expect(GEMINI_SCHEMA_ADAPTER_VERSION).toBe('1.0.0');
    });
  });
});
