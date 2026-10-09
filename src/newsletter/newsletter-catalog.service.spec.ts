import { BadRequestException } from '@nestjs/common';
import {
  FindManyOptions,
  FindOperator,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';
import { Venue } from '../apis/venues/entities/venue.entity';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { MAX_NEWSLETTER_CATALOG_RESULTS } from './newsletter.constants';

describe('NewsletterCatalogService', () => {
  const find = jest.fn<Promise<Concert[]>, [FindManyOptions<Concert>]>();
  let service: NewsletterCatalogService;

  const baseConcert = (overrides: Partial<Concert> = {}): Concert =>
    ({
      id: '8da58775-806a-43a4-a526-824c73027106',
      title: 'Dr. Bacon at The Pour House',
      genre: 'Funk',
      startsAt: new Date('2026-10-10T00:00:00.000Z'),
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isAdminApproved: true,
      isFeatured: true,
      isTopPick: true,
      topPickScore: 0.9,
      description: 'A hometown funk show.',
      venue: {
        name: 'The Pour House Music Hall',
        city: 'Raleigh',
        region: 'NC',
      },
      lineup: [{ band: { name: 'Dr. Bacon' } }],
      ...overrides,
    }) as Concert;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NewsletterCatalogService({
      find,
    } as unknown as Repository<Concert>);
  });

  it('enforces the active and admin-approved catalog boundary', async () => {
    find.mockResolvedValue([baseConcert()]);

    const results = await service.findApprovedConcerts({
      start: new Date('2026-10-09T00:00:00.000Z'),
      end: new Date('2026-10-11T00:00:00.000Z'),
    });

    const options = find.mock.calls[0][0];
    const where = options.where as Record<string, unknown>;
    expect(where).toMatchObject({
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isAdminApproved: true,
    });
    expect(where.startsAt).toBeInstanceOf(FindOperator);
    expect(options.relations).toEqual(['venue', 'lineup', 'lineup.band']);
    expect(options.order).toEqual({ startsAt: 'ASC' });
    expect(options.take).toBeUndefined();
    expect(results).toEqual([
      expect.objectContaining({
        id: '8da58775-806a-43a4-a526-824c73027106',
        title: 'Dr. Bacon at The Pour House',
        venue: 'The Pour House Music Hall (Raleigh, NC)',
        artists: 'Dr. Bacon',
        isHighlightArtist: true,
        isPartnerArtist: true,
        source: 'Nido Concert Database',
      }),
    ]);
  });

  it('applies editorial and location filters before the result limit', async () => {
    find.mockResolvedValue([
      baseConcert({
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Durham Jazz Show',
        genre: 'Jazz',
        venue: {
          name: 'The Pinhook',
          city: 'Durham',
          region: 'North Carolina',
        } as Concert['venue'],
        lineup: [],
      }),
    ]);

    const results = await service.findApprovedConcerts({
      start: new Date('2026-10-09T00:00:00.000Z'),
      end: new Date('2026-10-11T00:00:00.000Z'),
      region: 'NC',
      cities: [' Durham '],
      genres: ['jazz'],
      excludeConcertIds: ['11111111-1111-4111-8111-111111111111'],
      limit: 1,
    });

    const options = find.mock.calls[0][0];
    const where = options.where as FindOptionsWhere<Concert>;
    const venueWhere = where.venue as FindOptionsWhere<Venue>;
    expect(options.take).toBe(1);
    expect((where.id as FindOperator<string>).type).toBe('not');
    expect((where.genre as FindOperator<string>).type).toBe('or');
    expect((venueWhere.region as FindOperator<string>).type).toBe('or');
    expect((venueWhere.city as FindOperator<string>).type).toBe('or');
    expect(results.map((concert) => concert.id)).toEqual([
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('preserves all admin preview matches when no limit is requested', async () => {
    const concerts = Array.from({ length: 101 }, (_, index) =>
      baseConcert({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        title: `Eligible Show ${index + 1}`,
      }),
    );
    find.mockResolvedValue(concerts);

    const results = await service.findApprovedConcerts({
      start: new Date('2026-10-09T00:00:00.000Z'),
      end: new Date('2026-10-11T00:00:00.000Z'),
    });

    expect(results).toHaveLength(101);
    expect(results.at(-1)?.title).toBe('Eligible Show 101');
  });

  it('preserves the opt-in legacy NC city and genre filter', async () => {
    find.mockResolvedValue([baseConcert()]);

    const results = await service.findApprovedConcerts({
      start: new Date('2026-10-09T00:00:00.000Z'),
      end: new Date('2026-10-11T00:00:00.000Z'),
      strictFiltering: true,
    });

    expect(results.map((concert) => concert.id)).toEqual([
      '8da58775-806a-43a4-a526-824c73027106',
    ]);
    const where = find.mock.calls[0][0].where as FindOptionsWhere<Concert>;
    const venueWhere = where.venue as FindOptionsWhere<Venue>;
    expect((where.genre as FindOperator<string>).type).toBe('or');
    expect((venueWhere.region as FindOperator<string>).type).toBe('or');
    expect((venueWhere.city as FindOperator<string>).type).toBe('or');
  });

  it.each([
    {
      query: {
        start: new Date('invalid'),
        end: new Date('2026-10-11T00:00:00.000Z'),
      },
      message: 'valid dates',
    },
    {
      query: {
        start: new Date('2026-10-12T00:00:00.000Z'),
        end: new Date('2026-10-11T00:00:00.000Z'),
      },
      message: 'before or equal',
    },
    {
      query: {
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2027-01-03T00:00:00.000Z'),
      },
      message: 'date range cannot exceed 366 days',
    },
    {
      query: {
        start: new Date('2026-10-09T00:00:00.000Z'),
        end: new Date('2026-10-11T00:00:00.000Z'),
        limit: MAX_NEWSLETTER_CATALOG_RESULTS + 1,
      },
      message: `between 1 and ${MAX_NEWSLETTER_CATALOG_RESULTS}`,
    },
  ])('rejects an invalid bounded query', async ({ query, message }) => {
    await expect(service.findApprovedConcerts(query)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.findApprovedConcerts(query)).rejects.toThrow(message);
    expect(find).not.toHaveBeenCalled();
  });
});
