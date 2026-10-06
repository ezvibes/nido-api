import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';

export const MAX_NEWSLETTER_CATALOG_RESULTS = 100;

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
      where: {
        startsAt: Between(query.start, query.end),
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        isAdminApproved: true,
      },
      relations: ['venue', 'lineup', 'lineup.band'],
      order: { startsAt: 'ASC' },
    });

    const filtered = concerts.filter((concert) =>
      this.matchesFilters(concert, query),
    );
    const selected = query.limit ? filtered.slice(0, query.limit) : filtered;

    return selected.map((concert) => this.toNewsletterSource(concert));
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

  private matchesFilters(
    concert: Concert,
    filters: NewsletterCatalogFilters,
  ): boolean {
    if (filters.excludeConcertIds?.includes(concert.id)) return false;
    if (filters.featuredOnly && !concert.isFeatured) return false;
    if (filters.topPicksOnly && !concert.isTopPick) return false;

    const region = this.normalize(concert.venue?.region);
    const city = this.normalize(concert.venue?.city);
    const genre = this.normalize(concert.genre);
    const venue = this.normalize(concert.venue?.name);

    if (filters.strictFiltering) {
      return (
        this.isNorthCarolina(region) &&
        LEGACY_TARGET_CITIES.some((target) => city.includes(target)) &&
        LEGACY_TARGET_GENRES.some((target) => genre.includes(target))
      );
    }

    if (filters.region && !this.regionsMatch(region, filters.region))
      return false;
    if (!this.matchesAny(city, filters.cities)) return false;
    if (!this.matchesAny(genre, filters.genres)) return false;
    if (!this.matchesAny(venue, filters.venues)) return false;

    return true;
  }

  private matchesAny(value: string, candidates?: string[]): boolean {
    const normalizedCandidates = (candidates || [])
      .map((candidate) => this.normalize(candidate))
      .filter(Boolean);
    return (
      normalizedCandidates.length === 0 ||
      normalizedCandidates.some((candidate) => value.includes(candidate))
    );
  }

  private regionsMatch(
    concertRegion: string,
    requestedRegion: string,
  ): boolean {
    const target = this.normalize(requestedRegion);
    if (concertRegion === target) return true;
    return this.isNorthCarolina(concertRegion) && this.isNorthCarolina(target);
  }

  private isNorthCarolina(region: string): boolean {
    return region === 'nc' || region === 'north carolina';
  }

  private normalize(value?: string | null): string {
    return (value || '').toLowerCase().trim();
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
