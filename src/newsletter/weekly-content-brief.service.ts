import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';
import { ConcertUpload } from '../ingestion/entities/concert-upload.entity';
import { inferTimezoneFromLocation } from '../ingestion/utils/timezone-lookup.util';
import {
  MissingFactFlag,
  WeeklyBriefCandidate,
  WeeklyBriefCollaborator,
  WeeklyContentBrief,
  WeeklyContentBriefSchema,
} from '../contracts/content-brief.contract';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { MAX_NEWSLETTER_CATALOG_RANGE_DAYS } from './newsletter.constants';

export interface GenerateWeeklyBriefOptions {
  daysAhead?: number;
  limit?: number;
  campaignTheme?: string;
}

const DEFAULT_DAYS_AHEAD = 7;
const MIN_DAYS_AHEAD = 1;
const DEFAULT_LIMIT = 8;
const MIN_LIMIT = 1;
const MAX_LIMIT = 10;
const DEFAULT_TIMEZONE = 'America/New_York';

@Injectable()
export class WeeklyContentBriefService {
  constructor(
    private readonly newsletterCatalogService: NewsletterCatalogService,
    @Optional()
    @InjectRepository(ConcertUpload)
    private readonly concertUploadRepository?: Repository<ConcertUpload>,
  ) {}

  async generateBrief(
    options: GenerateWeeklyBriefOptions = {},
  ): Promise<WeeklyContentBrief> {
    const daysAhead = this.clampInteger(
      options.daysAhead,
      DEFAULT_DAYS_AHEAD,
      MIN_DAYS_AHEAD,
      MAX_NEWSLETTER_CATALOG_RANGE_DAYS,
    );
    const limit = this.clampInteger(
      options.limit,
      DEFAULT_LIMIT,
      MIN_LIMIT,
      MAX_LIMIT,
    );
    const campaignTheme = options.campaignTheme?.trim() || null;

    const now = new Date();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1_000);

    const rawConcerts =
      await this.newsletterCatalogService.findApprovedConcertEntities({
        start: now,
        end,
        limit,
      });

    const approvedConcerts = rawConcerts
      .filter(
        (concert) =>
          concert.catalogStatus === ConcertCatalogStatus.ACTIVE &&
          concert.isAdminApproved === true,
      )
      .slice(0, limit);

    const uploadsByConcertId = await this.loadUploadsByConcertId(
      approvedConcerts.map((concert) => concert.id),
    );

    const candidates = approvedConcerts.map((concert) =>
      this.toCandidate(
        concert,
        uploadsByConcertId.get(concert.id) ?? [],
        campaignTheme,
      ),
    );

    return WeeklyContentBriefSchema.parse({
      generatedAt: now.toISOString(),
      windowStart: now.toISOString(),
      windowEnd: end.toISOString(),
      daysAhead,
      limit,
      campaignTheme,
      totalCandidates: candidates.length,
      candidates,
    });
  }

  formatAsMarkdown(brief: WeeklyContentBrief): string {
    const lines: string[] = [
      '# Weekly Content Brief',
      '',
      `- **Generated:** ${brief.generatedAt}`,
      `- **Window:** ${brief.windowStart.slice(0, 10)} to ${brief.windowEnd.slice(0, 10)} (${brief.daysAhead} days)`,
      `- **Limit:** ${brief.limit} | **Candidates:** ${brief.totalCandidates}`,
    ];

    if (brief.campaignTheme) {
      lines.push(`- **Campaign Theme:** ${brief.campaignTheme}`);
    }

    lines.push('');

    if (brief.candidates.length === 0) {
      lines.push(
        '_No active, admin-approved upcoming concerts found in this window._',
      );
      return lines.join('\n');
    }

    brief.candidates.forEach((candidate, index) => {
      const locationParts = [candidate.city, candidate.state].filter(Boolean);
      const locationSuffix =
        locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';
      const collaboratorsText =
        candidate.verifiedCollaborators.length > 0
          ? candidate.verifiedCollaborators
              .map((c) => `${c.bandName} (${c.instagramHandle})`)
              .join(', ')
          : 'None verified';
      const mediaText =
        candidate.mediaRefs.length > 0
          ? candidate.mediaRefs.join(', ')
          : 'None';
      const tagsText =
        candidate.editorialTags.length > 0
          ? candidate.editorialTags.join(', ')
          : 'None';
      const missingText =
        candidate.missingFacts.length > 0
          ? candidate.missingFacts.join(', ')
          : 'None';

      lines.push(`## ${index + 1}. ${candidate.title}`);
      lines.push(`- **Date:** ${candidate.localDate}`);
      lines.push(
        `- **Time:** ${candidate.confirmedTime ?? 'Unconfirmed (do not invent)'}`,
      );
      lines.push(`- **Venue:** ${candidate.venueName}${locationSuffix}`);
      lines.push(
        `- **Artists:** ${candidate.artists.length > 0 ? candidate.artists.join(', ') : 'TBA'}`,
      );
      lines.push(`- **Genre:** ${candidate.genre ?? 'Unspecified'}`);
      lines.push(`- **Source URL:** ${candidate.sourceUrl}`);
      lines.push(`- **Ticket URL:** ${candidate.ticketUrl ?? 'Missing'}`);
      lines.push(`- **Verified Collaborators:** ${collaboratorsText}`);
      lines.push(`- **Media Refs:** ${mediaText}`);
      lines.push(`- **Editorial Tags:** ${tagsText}`);
      lines.push(`- **Editorial Angle:** ${candidate.editorialAngle}`);
      lines.push(`- **Missing Facts:** ${missingText}`);
      lines.push('');
    });

    return lines.join('\n').trimEnd();
  }

  private async loadUploadsByConcertId(
    concertIds: string[],
  ): Promise<Map<string, ConcertUpload[]>> {
    const map = new Map<string, ConcertUpload[]>();
    if (!concertIds.length || !this.concertUploadRepository) {
      return map;
    }

    const uploads = await this.concertUploadRepository.find({
      where: { concertId: In(concertIds) },
      order: { createdAt: 'DESC' },
    });

    for (const upload of uploads) {
      if (!upload.concertId) continue;
      const existing = map.get(upload.concertId) ?? [];
      existing.push(upload);
      map.set(upload.concertId, existing);
    }

    return map;
  }

  private toCandidate(
    concert: Concert,
    uploads: ConcertUpload[],
    campaignTheme: string | null,
  ): WeeklyBriefCandidate {
    const sortedLineup = [...(concert.lineup ?? [])].sort(
      (a, b) => (a.performanceOrder ?? 999) - (b.performanceOrder ?? 999),
    );

    const artists: string[] = [];
    const verifiedCollaborators: WeeklyBriefCollaborator[] = [];
    const seenBandIds = new Set<string>();
    const mediaRefs: string[] = [];
    const seenMedia = new Set<string>();

    for (const upload of uploads) {
      const uploadPath = `/ingestion/uploads/${upload.id}/image`;
      if (!seenMedia.has(uploadPath)) {
        seenMedia.add(uploadPath);
        mediaRefs.push(uploadPath);
      }
    }

    for (const entry of sortedLineup) {
      const band = entry.band;
      if (!band) continue;

      const bandName = band.name?.trim();
      if (bandName && !artists.includes(bandName)) {
        artists.push(bandName);
      }

      const promoImage = band.promoImageUrl?.trim();
      if (promoImage && !seenMedia.has(promoImage)) {
        seenMedia.add(promoImage);
        mediaRefs.push(promoImage);
      }

      const normalizedHandle = this.normalizeInstagramHandle(
        band.instagramHandle,
      );
      if (normalizedHandle && band.id && !seenBandIds.has(band.id)) {
        seenBandIds.add(band.id);
        verifiedCollaborators.push({
          bandId: band.id,
          bandName: bandName || band.id,
          instagramHandle: normalizedHandle,
        });
      }
    }

    const venueName = concert.venue?.name?.trim() || 'Unknown Venue';
    const city = concert.venue?.city?.trim() || null;
    const state = concert.venue?.region?.trim() || null;
    const timezone =
      inferTimezoneFromLocation(state ?? undefined, city ?? undefined) ||
      DEFAULT_TIMEZONE;

    const localDate = this.formatLocalDate(concert.startsAt, timezone);
    const confirmedTime = this.extractConfirmedTime(concert.startsAt, timezone);
    const ticketUrl = concert.ticketUrl?.trim() || null;
    const genre = concert.genre?.trim() || null;

    const missingFacts: MissingFactFlag[] = [];
    if (!ticketUrl) {
      missingFacts.push('missing_ticket_url');
    }
    if (!confirmedTime) {
      missingFacts.push('unconfirmed_time');
    }
    if (mediaRefs.length === 0) {
      missingFacts.push('missing_poster_media');
    }
    if (verifiedCollaborators.length === 0) {
      missingFacts.push('missing_verified_artist_ig_handle');
    }

    const editorialTags = this.buildEditorialTags(
      concert,
      artists,
      genre,
      campaignTheme,
    );
    const editorialAngle = this.buildEditorialAngle(
      concert,
      artists,
      venueName,
      city,
      state,
      genre,
      campaignTheme,
    );

    return {
      concertId: concert.id,
      title: concert.title,
      artists,
      venueName,
      city,
      state,
      localDate,
      confirmedTime,
      genre,
      editorialTags,
      sourceUrl: `/concerts/${concert.id}`,
      ticketUrl,
      editorialAngle,
      missingFacts,
      mediaRefs,
      verifiedCollaborators,
    };
  }

  private normalizeInstagramHandle(handle?: string | null): string | null {
    const trimmed = handle?.trim();
    if (!trimmed) {
      return null;
    }
    const cleaned = trimmed.replace(/^@+/, '').trim();
    if (!cleaned) {
      return null;
    }
    return `@${cleaned}`;
  }

  private formatLocalDate(
    startsAt: Date | undefined,
    timezone: string,
  ): string {
    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
      return '1970-01-01';
    }
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    }).format(startsAt);
  }

  private extractConfirmedTime(
    startsAt: Date | undefined,
    timezone: string,
  ): string | null {
    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
      return null;
    }

    // Midnight UTC (00:00:00Z) is commonly produced by date-only ISO strings.
    const isUtcMidnight =
      startsAt.getUTCHours() === 0 &&
      startsAt.getUTCMinutes() === 0 &&
      startsAt.getUTCSeconds() === 0;
    if (isUtcMidnight) {
      return null;
    }

    const local24h = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(startsAt);
    if (local24h === '00:00' || local24h === '24:00') {
      return null;
    }

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(startsAt);
  }

  private buildEditorialTags(
    concert: Concert,
    artists: string[],
    genre: string | null,
    campaignTheme: string | null,
  ): string[] {
    const tags: string[] = [];
    if (concert.isTopPick) {
      tags.push('top-pick');
    }
    if (concert.isFeatured) {
      tags.push('featured');
    }
    if (artists.length > 1) {
      tags.push('co-bill');
    }
    if (genre) {
      tags.push(genre.toLowerCase());
    }
    if (campaignTheme) {
      const themeLower = campaignTheme.toLowerCase();
      const haystack = [
        concert.title,
        concert.genre,
        concert.description,
        concert.venue?.name,
        concert.venue?.city,
        ...artists,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (haystack.includes(themeLower)) {
        tags.push('theme-match');
      }
    }
    return [...new Set(tags)];
  }

  private buildEditorialAngle(
    concert: Concert,
    artists: string[],
    venueName: string,
    city: string | null,
    state: string | null,
    genre: string | null,
    campaignTheme: string | null,
  ): string {
    const location = [city, state].filter(Boolean).join(', ');
    const venuePart = location ? `${venueName} in ${location}` : venueName;
    const headlinerPart =
      artists.length > 0 ? artists.join(' + ') : concert.title;

    const descriptors: string[] = [];
    if (concert.isTopPick) {
      descriptors.push('Weekly Top Pick');
    } else if (concert.isFeatured) {
      descriptors.push('Featured show');
    }
    if (genre) {
      descriptors.push(`${genre} bill`);
    }

    const lead =
      descriptors.length > 0
        ? `${descriptors.join(' • ')}: ${headlinerPart} at ${venuePart}.`
        : `${headlinerPart} at ${venuePart}.`;

    const descriptionSnippet = concert.description?.trim().slice(0, 140);
    if (descriptionSnippet) {
      return `${lead} ${descriptionSnippet}`;
    }
    if (campaignTheme) {
      return `${lead} Framed for "${campaignTheme}" weekly coverage.`;
    }
    return lead;
  }

  private clampInteger(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined || !Number.isFinite(value)) {
      return fallback;
    }
    const truncated = Math.trunc(value);
    return Math.min(max, Math.max(min, truncated));
  }
}
