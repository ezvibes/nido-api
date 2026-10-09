import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { Band } from '../apis/bands/entities/band.entity';
import { ConcertBandLineup } from '../apis/concerts/entities/concert-band-lineup.entity';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';
import { Venue } from '../apis/venues/entities/venue.entity';
import {
  DEFAULT_CO_BILL_LOOKBACK_MONTHS,
  DEFAULT_CO_BILL_RESULTS,
  MAX_CO_BILL_ANCHORS,
  MAX_CO_BILL_LOOKBACK_MONTHS,
  MAX_CO_BILL_RESULTS,
  MAX_CO_BILL_SHARED_BILLS,
  MAX_CO_BILL_PREFERRED_VENUES,
  MAX_CO_BILL_TARGET_RANGE_DAYS,
  MAX_CO_BILL_VENUE_NAME_LENGTH,
} from './newsletter.constants';

export interface CoBillRecommendationQuery {
  anchorBandIds: string[];
  targetStart: Date;
  targetEnd: Date;
  preferredVenues?: string[];
  historicalLookbackMonths?: number;
  minimumSharedBills?: number;
  limit?: number;
}

export interface CoBillRecommendation {
  candidateBand: {
    id: string;
    name: string;
  };
  connection: {
    anchorBandId: string;
    anchorBandName: string;
    sharedBillCount: number;
  };
  upcomingConcert: {
    id: string;
    title: string;
    startsAt: string;
    venue?: {
      id: string;
      name: string;
      city: string;
      region: string;
    };
  };
}

interface RawCoBillRecommendation {
  candidateBandId: string;
  candidateBandName: string;
  anchorBandId: string;
  anchorBandName: string;
  sharedBillCount: string | number;
  upcomingConcertId: string;
  upcomingConcertTitle: string;
  upcomingConcertStartsAt: Date | string;
  venueId?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  venueRegion?: string | null;
}

@Injectable()
export class NewsletterCoBillService {
  constructor(
    @InjectRepository(ConcertBandLineup)
    private readonly lineupRepository: Repository<ConcertBandLineup>,
  ) {}

  async findRecommendations(
    query: CoBillRecommendationQuery,
  ): Promise<CoBillRecommendation[]> {
    this.validateQuery(query);

    const historicalLookbackMonths =
      query.historicalLookbackMonths ?? DEFAULT_CO_BILL_LOOKBACK_MONTHS;
    const minimumSharedBills = query.minimumSharedBills ?? 1;
    const limit = query.limit ?? DEFAULT_CO_BILL_RESULTS;
    const historicalStart = this.subtractUtcMonths(
      query.targetStart,
      historicalLookbackMonths,
    );
    const preferredVenues = query.preferredVenues
      ?.map((venue) => venue.trim().toLowerCase())
      .filter(Boolean);

    const queryBuilder = this.lineupRepository
      .createQueryBuilder('historicalAnchor')
      .innerJoin(
        ConcertBandLineup,
        'historicalCandidate',
        'historicalCandidate.concertId = historicalAnchor.concertId AND historicalCandidate.bandId != historicalAnchor.bandId',
      )
      .innerJoin(
        Concert,
        'historicalConcert',
        'historicalConcert.id = historicalAnchor.concertId',
      )
      .innerJoin(Band, 'anchorBand', 'anchorBand.id = historicalAnchor.bandId')
      .innerJoin(
        Band,
        'candidateBand',
        'candidateBand.id = historicalCandidate.bandId',
      )
      .innerJoin(
        ConcertBandLineup,
        'upcomingLineup',
        'upcomingLineup.bandId = candidateBand.id',
      )
      .innerJoin(
        Concert,
        'upcomingConcert',
        'upcomingConcert.id = upcomingLineup.concertId',
      )
      .leftJoin(
        Venue,
        'upcomingVenue',
        'upcomingVenue.id = upcomingConcert.venueId',
      )
      .select('candidateBand.id', 'candidateBandId')
      .addSelect('candidateBand.name', 'candidateBandName')
      .addSelect('anchorBand.id', 'anchorBandId')
      .addSelect('anchorBand.name', 'anchorBandName')
      .addSelect(
        'COUNT(DISTINCT historicalAnchor.concertId)',
        'sharedBillCount',
      )
      .addSelect('upcomingConcert.id', 'upcomingConcertId')
      .addSelect('upcomingConcert.title', 'upcomingConcertTitle')
      .addSelect('upcomingConcert.startsAt', 'upcomingConcertStartsAt')
      .addSelect('upcomingVenue.id', 'venueId')
      .addSelect('upcomingVenue.name', 'venueName')
      .addSelect('upcomingVenue.city', 'venueCity')
      .addSelect('upcomingVenue.region', 'venueRegion')
      .where('historicalAnchor.bandId IN (:...anchorBandIds)', {
        anchorBandIds: query.anchorBandIds,
      })
      .andWhere('historicalCandidate.bandId NOT IN (:...anchorBandIds)', {
        anchorBandIds: query.anchorBandIds,
      })
      .andWhere('historicalConcert.startsAt >= :historicalStart', {
        historicalStart,
      })
      .andWhere('historicalConcert.startsAt < :targetStart', {
        targetStart: query.targetStart,
      })
      .andWhere('historicalConcert.catalogStatus = :catalogStatus', {
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      })
      .andWhere('historicalConcert.isAdminApproved = :isAdminApproved', {
        isAdminApproved: true,
      })
      .andWhere('upcomingConcert.startsAt >= :targetStart', {
        targetStart: query.targetStart,
      })
      .andWhere('upcomingConcert.startsAt <= :targetEnd', {
        targetEnd: query.targetEnd,
      })
      .andWhere('upcomingConcert.catalogStatus = :catalogStatus', {
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      })
      .andWhere('upcomingConcert.isAdminApproved = :isAdminApproved', {
        isAdminApproved: true,
      });

    if (preferredVenues?.length) {
      queryBuilder.andWhere(
        'LOWER(upcomingVenue.name) IN (:...preferredVenues)',
        {
          preferredVenues,
        },
      );
    }

    const rows = await queryBuilder
      .groupBy('candidateBand.id')
      .addGroupBy('candidateBand.name')
      .addGroupBy('anchorBand.id')
      .addGroupBy('anchorBand.name')
      .addGroupBy('upcomingConcert.id')
      .addGroupBy('upcomingConcert.title')
      .addGroupBy('upcomingConcert.startsAt')
      .addGroupBy('upcomingVenue.id')
      .addGroupBy('upcomingVenue.name')
      .addGroupBy('upcomingVenue.city')
      .addGroupBy('upcomingVenue.region')
      .having(
        'COUNT(DISTINCT historicalAnchor.concertId) >= :minimumSharedBills',
        {
          minimumSharedBills,
        },
      )
      .orderBy('COUNT(DISTINCT historicalAnchor.concertId)', 'DESC')
      .addOrderBy('upcomingConcert.startsAt', 'ASC')
      .addOrderBy('candidateBand.name', 'ASC')
      .limit(limit)
      .getRawMany<RawCoBillRecommendation>();

    return rows.map((row) => this.toRecommendation(row));
  }

  private validateQuery(query: CoBillRecommendationQuery): void {
    if (
      query.anchorBandIds.length === 0 ||
      query.anchorBandIds.length > MAX_CO_BILL_ANCHORS ||
      query.anchorBandIds.some((id) => !isUUID(id))
    ) {
      throw new BadRequestException(
        `Co-bill recommendations require 1 to ${MAX_CO_BILL_ANCHORS} valid anchor band UUIDs.`,
      );
    }
    if (
      !(query.targetStart instanceof Date) ||
      Number.isNaN(query.targetStart.getTime()) ||
      !(query.targetEnd instanceof Date) ||
      Number.isNaN(query.targetEnd.getTime()) ||
      query.targetStart > query.targetEnd
    ) {
      throw new BadRequestException(
        'Co-bill target dates must be valid and start before or at the end date.',
      );
    }
    if (
      query.targetEnd.getTime() - query.targetStart.getTime() >
      MAX_CO_BILL_TARGET_RANGE_DAYS * 24 * 60 * 60 * 1_000
    ) {
      throw new BadRequestException(
        `Co-bill target date range cannot exceed ${MAX_CO_BILL_TARGET_RANGE_DAYS} days.`,
      );
    }
    if (
      query.preferredVenues &&
      (query.preferredVenues.length > MAX_CO_BILL_PREFERRED_VENUES ||
        query.preferredVenues.some(
          (venue) =>
            !venue.trim() ||
            venue.trim().length > MAX_CO_BILL_VENUE_NAME_LENGTH,
        ))
    ) {
      throw new BadRequestException(
        `Co-bill preferred venues must contain at most ${MAX_CO_BILL_PREFERRED_VENUES} nonblank names of ${MAX_CO_BILL_VENUE_NAME_LENGTH} characters or fewer.`,
      );
    }
    this.validateBoundedInteger(
      query.historicalLookbackMonths,
      1,
      MAX_CO_BILL_LOOKBACK_MONTHS,
      'historical lookback months',
    );
    this.validateBoundedInteger(
      query.minimumSharedBills,
      1,
      MAX_CO_BILL_SHARED_BILLS,
      'minimum shared bills',
    );
    this.validateBoundedInteger(
      query.limit,
      1,
      MAX_CO_BILL_RESULTS,
      'result limit',
    );
  }

  private validateBoundedInteger(
    value: number | undefined,
    minimum: number,
    maximum: number,
    label: string,
  ): void {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < minimum || value > maximum)
    ) {
      throw new BadRequestException(
        `Co-bill ${label} must be an integer between ${minimum} and ${maximum}.`,
      );
    }
  }

  private subtractUtcMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const originalDay = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() - months);
    const daysInTargetMonth = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
    return result;
  }

  private toRecommendation(row: RawCoBillRecommendation): CoBillRecommendation {
    const venue =
      row.venueId && row.venueName && row.venueCity && row.venueRegion
        ? {
            id: row.venueId,
            name: row.venueName,
            city: row.venueCity,
            region: row.venueRegion,
          }
        : undefined;

    return {
      candidateBand: {
        id: row.candidateBandId,
        name: row.candidateBandName,
      },
      connection: {
        anchorBandId: row.anchorBandId,
        anchorBandName: row.anchorBandName,
        sharedBillCount: Number(row.sharedBillCount),
      },
      upcomingConcert: {
        id: row.upcomingConcertId,
        title: row.upcomingConcertTitle,
        startsAt: new Date(row.upcomingConcertStartsAt).toISOString(),
        venue,
      },
    };
  }
}
