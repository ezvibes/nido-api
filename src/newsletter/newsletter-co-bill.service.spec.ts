import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConcertBandLineup } from '../apis/concerts/entities/concert-band-lineup.entity';
import { ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';
import {
  MAX_CO_BILL_RESULTS,
  MAX_CO_BILL_SHARED_BILLS,
} from './newsletter.constants';
import { NewsletterCoBillService } from './newsletter-co-bill.service';

describe('NewsletterCoBillService', () => {
  const anchorBandId = '11111111-1111-4111-8111-111111111111';
  const candidateBandId = '22222222-2222-4222-8222-222222222222';
  const concertId = '33333333-3333-4333-8333-333333333333';
  const venueId = '44444444-4444-4444-8444-444444444444';

  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
  let service: NewsletterCoBillService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(queryBuilder).forEach((mock) => {
      if (mock !== queryBuilder.getRawMany) mock.mockReturnValue(queryBuilder);
    });
    service = new NewsletterCoBillService({
      createQueryBuilder,
    } as unknown as Repository<ConcertBandLineup>);
  });

  it('returns evidence-backed recommendations from the relational query', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        candidateBandId,
        candidateBandName: 'Discovery Band',
        anchorBandId,
        anchorBandName: 'Anchor Band',
        sharedBillCount: '3',
        upcomingConcertId: concertId,
        upcomingConcertTitle: 'Discovery Band at The Pinhook',
        upcomingConcertStartsAt: '2026-11-08T01:00:00.000Z',
        venueId,
        venueName: 'The Pinhook',
        venueCity: 'Durham',
        venueRegion: 'NC',
      },
    ]);

    const results = await service.findRecommendations({
      anchorBandIds: [anchorBandId],
      targetStart: new Date('2026-11-01T00:00:00.000Z'),
      targetEnd: new Date('2026-11-30T23:59:59.999Z'),
      preferredVenues: [' The Pinhook '],
      historicalLookbackMonths: 24,
      minimumSharedBills: 2,
      limit: 10,
    });

    expect(createQueryBuilder).toHaveBeenCalledWith('historicalAnchor');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'upcomingConcert.catalogStatus = :catalogStatus',
      { catalogStatus: ConcertCatalogStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'historicalConcert.isAdminApproved = :isAdminApproved',
      { isAdminApproved: true },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'upcomingConcert.isAdminApproved = :isAdminApproved',
      { isAdminApproved: true },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(upcomingVenue.name) IN (:...preferredVenues)',
      { preferredVenues: ['the pinhook'] },
    );
    expect(queryBuilder.having).toHaveBeenCalledWith(
      'COUNT(DISTINCT historicalAnchor.concertId) >= :minimumSharedBills',
      { minimumSharedBills: 2 },
    );
    expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    expect(results).toEqual([
      {
        candidateBand: { id: candidateBandId, name: 'Discovery Band' },
        connection: {
          anchorBandId,
          anchorBandName: 'Anchor Band',
          sharedBillCount: 3,
        },
        upcomingConcert: {
          id: concertId,
          title: 'Discovery Band at The Pinhook',
          startsAt: '2026-11-08T01:00:00.000Z',
          venue: {
            id: venueId,
            name: 'The Pinhook',
            city: 'Durham',
            region: 'NC',
          },
        },
      },
    ]);
  });

  it('uses bounded defaults and omits the optional venue predicate', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.findRecommendations({
      anchorBandIds: [anchorBandId],
      targetStart: new Date('2026-11-01T00:00:00.000Z'),
      targetEnd: new Date('2026-11-30T23:59:59.999Z'),
    });

    expect(queryBuilder.having).toHaveBeenCalledWith(expect.any(String), {
      minimumSharedBills: 1,
    });
    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('preferredVenues'),
      expect.anything(),
    );
  });

  it.each([
    {
      query: {
        anchorBandIds: [],
        targetStart: new Date('2026-11-01T00:00:00.000Z'),
        targetEnd: new Date('2026-11-30T23:59:59.999Z'),
      },
      message: 'valid anchor band UUIDs',
    },
    {
      query: {
        anchorBandIds: [anchorBandId],
        targetStart: new Date('2026-12-01T00:00:00.000Z'),
        targetEnd: new Date('2026-11-30T23:59:59.999Z'),
      },
      message: 'start before or at the end date',
    },
    {
      query: {
        anchorBandIds: [anchorBandId],
        targetStart: new Date('2026-11-01T00:00:00.000Z'),
        targetEnd: new Date('2026-11-30T23:59:59.999Z'),
        limit: MAX_CO_BILL_RESULTS + 1,
      },
      message: 'result limit',
    },
    {
      query: {
        anchorBandIds: [anchorBandId],
        targetStart: new Date('2026-11-01T00:00:00.000Z'),
        targetEnd: new Date('2026-11-30T23:59:59.999Z'),
        minimumSharedBills: MAX_CO_BILL_SHARED_BILLS + 1,
      },
      message: 'minimum shared bills',
    },
    {
      query: {
        anchorBandIds: [anchorBandId],
        targetStart: new Date('2026-11-01T00:00:00.000Z'),
        targetEnd: new Date('2028-01-01T00:00:00.000Z'),
      },
      message: 'cannot exceed 366 days',
    },
    {
      query: {
        anchorBandIds: [anchorBandId],
        targetStart: new Date('2026-11-01T00:00:00.000Z'),
        targetEnd: new Date('2026-11-30T23:59:59.999Z'),
        preferredVenues: ['   '],
      },
      message: 'nonblank names',
    },
  ])('rejects invalid query bounds', async ({ query, message }) => {
    await expect(service.findRecommendations(query)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.findRecommendations(query)).rejects.toThrow(message);
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});
