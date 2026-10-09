import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOperator,
  FindOptionsWhere,
  ILike,
  In,
  Not,
  Or,
  Repository,
} from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';
import {
  MAX_NEWSLETTER_CATALOG_RANGE_DAYS,
  MAX_NEWSLETTER_CATALOG_RESULTS,
} from './newsletter.constants';
import { Venue } from '../apis/venues/entities/venue.entity';

const HIGHLIGHT_ARTISTS = [
  'dr bacon',
  'dr. bacon',
  'big fur',
  'larry keel',
  'sam fribush',
  'treehouse',
  'treehouse!',
  'julia',
  'africa unplugged',
  'nth power',
  'the nth power',
  'chill paxton',
  'toubab krewe',
  'tand',
  'badfish',
  'sons of paradise',
  'eggy',
  'daniel donato',
  'dogs in a pile',
  'billy strings',
];

const LEGACY_TARGET_CITIES = [
  'raleigh',
  'durham',
  'chapel hill',
  'carrboro',
  'greensboro',
  'winston-salem',
  'charlotte',
  'asheville',
  'wilmington',
];

const LEGACY_TARGET_GENRES = [
  'funk',
  'bluegrass',
  'jam',
  'reggae',
  'hip-hop',
  'hip hop',
  'salsa',
  'rock',
  'electronic',
  'folk',
  'latin',
];

export interface NewsletterSourceConcert {
  id?: string;
  title: string;
  date: string;
  venue: string;
  artists?: string;
  genre?: string;
  description?: string;
  rawText?: string;
  isTopPick: boolean;
  topPickScore: number;
  isHighlightArtist: boolean;
  isPartnerArtist: boolean;
  source: string;
}

export interface NewsletterCatalogConcert extends NewsletterSourceConcert {
  id: string;
}

export interface NewsletterCatalogFilters {
  cities?: string[];
  genres?: string[];
  venues?: string[];
  region?: string;
  strictFiltering?: boolean;
  featuredOnly?: boolean;
  topPicksOnly?: boolean;
  excludeConcertIds?: string[];
}

export interface ApprovedNewsletterConcertQuery extends NewsletterCatalogFilters {
  start: Date;
  end: Date;
  limit?: number;
}

@Injectable()
export class NewsletterCatalogService {
  private readonly logger = new Logger(NewsletterCatalogService.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
  ) {}

  /**
   * Returns normalized newsletter sources from the canonical catalog.
   * Publication eligibility is enforced here so previews and future agent tools
   * cannot accidentally diverge on active/admin-approved visibility rules.
   */
  async findApprovedConcerts(
    query: ApprovedNewsletterConcertQuery,
  ): Promise<NewsletterCatalogConcert[]> {
    this.validateQuery(query);

    const resultScope = query.limit ? `up to ${query.limit}` : 'all';
    this.logger.log(
      `Fetching ${resultScope} active approved concerts between ${query.start.toISOString()} and ${query.end.toISOString()}...`,
    );

    const concerts = await this.concertRepository.find({
      where: this.buildWhere(query),
      relations: ['venue', 'lineup', 'lineup.band'],
      order: { startsAt: 'ASC' },
      take: query.limit,
    });

    return concerts.map((concert) => this.toNewsletterSource(concert));
  }

  private validateQuery(query: ApprovedNewsletterConcertQuery): void {
    if (
      !(query.start instanceof Date) ||
      Number.isNaN(query.start.getTime()) ||
      !(query.end instanceof Date) ||
      Number.isNaN(query.end.getTime())
    ) {
      throw new BadRequestException(
        'Newsletter catalog start and end must be valid dates.',
      );
    }
    if (query.start > query.end) {
      throw new BadRequestException(
        'Newsletter catalog start must be before or equal to end.',
      );
    }
    if (
      query.end.getTime() - query.start.getTime() >
      MAX_NEWSLETTER_CATALOG_RANGE_DAYS * 24 * 60 * 60 * 1_000
    ) {
      throw new BadRequestException(
        `Newsletter catalog date range cannot exceed ${MAX_NEWSLETTER_CATALOG_RANGE_DAYS} days.`,
      );
    }
    if (
      query.limit !== undefined &&
      (!Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > MAX_NEWSLETTER_CATALOG_RESULTS)
    ) {
      throw new BadRequestException(
        `Newsletter catalog limit must be an integer between 1 and ${MAX_NEWSLETTER_CATALOG_RESULTS}.`,
      );
    }
  }

  private buildWhere(
    query: ApprovedNewsletterConcertQuery,
  ): FindOptionsWhere<Concert> {
    const where: FindOptionsWhere<Concert> = {
      startsAt: Between(query.start, query.end),
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isAdminApproved: true,
    };

    if (query.excludeConcertIds?.length) {
      where.id = Not(In([...new Set(query.excludeConcertIds)]));
    }
    if (query.featuredOnly) where.isFeatured = true;
    if (query.topPicksOnly) where.isTopPick = true;

    const venueWhere: FindOptionsWhere<Venue> = {};
    if (query.strictFiltering) {
      venueWhere.region = this.regionOperator('nc');
      venueWhere.city = this.containsAnyOperator(LEGACY_TARGET_CITIES);
      where.genre = this.containsAnyOperator(LEGACY_TARGET_GENRES);
    } else {
      if (query.region) venueWhere.region = this.regionOperator(query.region);
      const cityFilter = this.containsAnyOperator(query.cities);
      if (cityFilter) venueWhere.city = cityFilter;
      const venueFilter = this.containsAnyOperator(query.venues);
      if (venueFilter) venueWhere.name = venueFilter;
      const genreFilter = this.containsAnyOperator(query.genres);
      if (genreFilter) where.genre = genreFilter;
    }

    if (Object.keys(venueWhere).length) where.venue = venueWhere;
    return where;
  }

  private containsAnyOperator(
    candidates?: string[],
  ): FindOperator<string> | undefined {
    const normalized = (candidates || [])
      .map((candidate) => this.normalize(candidate))
      .filter(Boolean);
    if (!normalized.length) return undefined;
    return Or(
      ...normalized.map((candidate) =>
        ILike(`%${this.escapeLikePattern(candidate)}%`),
      ),
    );
  }

  private regionOperator(region: string): FindOperator<string> {
    const normalized = this.normalize(region);
    const accepted = this.isNorthCarolina(normalized)
      ? ['nc', 'north carolina']
      : [normalized];
    return Or(...accepted.map((candidate) => ILike(candidate)));
  }

  private isNorthCarolina(region: string): boolean {
    return region === 'nc' || region === 'north carolina';
  }

  private normalize(value?: string | null): string {
    return (value || '').toLowerCase().trim();
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private toNewsletterSource(concert: Concert): NewsletterCatalogConcert {
    const lineupBands =
      concert.lineup
        ?.map((lineup) => lineup.band?.name)
        .filter((name): name is string => Boolean(name)) || [];
    const hasHighlightArtist =
      lineupBands.some((name) =>
        HIGHLIGHT_ARTISTS.some((artist) => name.toLowerCase().includes(artist)),
      ) ||
      HIGHLIGHT_ARTISTS.some((artist) =>
        concert.title.toLowerCase().includes(artist),
      );

    return {
      id: concert.id,
      title: concert.title,
      date: concert.startsAt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York',
      }),
      venue: concert.venue
        ? `${concert.venue.name} (${concert.venue.city}, ${concert.venue.region})`
        : 'Unknown Venue',
      artists: lineupBands.join(', '),
      genre: concert.genre,
      description: concert.description || '',
      isTopPick: Boolean(concert.isTopPick),
      topPickScore: concert.topPickScore ?? 0,
      isHighlightArtist: hasHighlightArtist,
      isPartnerArtist: hasHighlightArtist,
      source: 'Nido Concert Database',
    };
  }
}
