import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Between, In, Repository } from 'typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { Venue } from '../apis/venues/entities/venue.entity';
import { Band } from '../apis/bands/entities/band.entity';
import { ConcertBandLineup, PerformanceRole } from '../apis/concerts/entities/concert-band-lineup.entity';
import { VenueService } from '../apis/venues/venue.service';
import { BandService } from '../apis/bands/band.service';
import { User } from '../apis/users/entities/user.entity';
import { CreateConcertSyncJobDto } from './dto/create-concert-sync-job.dto';
import {
  ListConcertSyncJobsDto,
  type SyncJobStatus,
} from './dto/list-concert-sync-jobs.dto';
import { RefreshTopPicksDto } from './dto/refresh-top-picks.dto';
import { ConcertSyncEvent } from './entities/concert-sync-event.entity';
import { ConcertSyncJob } from './entities/concert-sync-job.entity';
import { GeminiConcertExtractorService } from './services/gemini-concert-extractor.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { IcalCalendarClientService } from './services/ical-calendar-client.service';
import type { ConcertExtractionResult } from './interfaces/concert-extraction.interface';
import type { GoogleCalendarEvent } from './interfaces/google-calendar-event.interface';

@Injectable()
export class ConcertSyncService {
  private readonly defaultCalendarId = 'primary';

  constructor(
    @InjectRepository(ConcertSyncJob)
    private readonly jobRepository: Repository<ConcertSyncJob>,
    @InjectRepository(ConcertSyncEvent)
    private readonly syncEventRepository: Repository<ConcertSyncEvent>,
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    private readonly calendarClient: GoogleCalendarClientService,
    private readonly icalCalendarClient: IcalCalendarClientService,
    private readonly geminiExtractor: GeminiConcertExtractorService,
    private readonly configService: ConfigService,
    private readonly venueService: VenueService,
    private readonly bandService: BandService,
  ) {}

  async createJobForOwner(owner: User, dto: CreateConcertSyncJobDto) {
    const calendarId = dto.calendarId?.trim() || this.defaultCalendarId;
    const rangeStart = dto.fromDate ? new Date(dto.fromDate) : null;
    const rangeEnd = dto.toDate ? new Date(dto.toDate) : null;
    const sampleEvents = Array.isArray(dto.sampleEvents)
      ? dto.sampleEvents
      : undefined;

    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      throw new BadRequestException('fromDate cannot be after toDate.');
    }
    const accessToken =
      dto.googleAccessToken?.trim() || this.getConfiguredCalendarAccessToken();

    if (
      !accessToken &&
      !sampleEvents?.length &&
      !this.isPublicCalendarUrl(calendarId) &&
      !this.calendarClient.hasConfiguredServerCredential()
    ) {
      throw new BadRequestException(
        'Google Calendar access is not configured. Set GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON or GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL and GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY.',
      );
    }

    const job = await this.jobRepository.save(
      this.jobRepository.create({
        owner,
        calendarId,
        status: 'queued',
        requestedRangeStart: rangeStart,
        requestedRangeEnd: rangeEnd,
        refreshTopPicks: dto.refreshTopPicks ?? true,
        jobMetadata: {
          geminiPrompt: dto.geminiPrompt?.trim() || null,
          geminiContext: dto.geminiContext?.trim() || null,
          dryRun: dto.dryRun ?? false,
          maxEvents: this.resolveMaxEvents(dto.maxEvents),
          geminiEnabled: this.geminiExtractor.isGeminiEnabled(),
          sampleMode: Boolean(sampleEvents?.length),
          syncSource: sampleEvents?.length
            ? 'sample_events'
            : this.isPublicCalendarUrl(calendarId)
              ? 'ical_calendar'
              : 'google_calendar',
        },
      }),
    );

    void this.runJob(job.id, {
      accessToken,
      customPrompt: dto.geminiPrompt,
      customContext: dto.geminiContext,
      sampleEvents: sampleEvents as GoogleCalendarEvent[] | undefined,
      dryRun: dto.dryRun ?? false,
      maxEvents: this.resolveMaxEvents(dto.maxEvents),
    });

    return this.formatJob(job);
  }

  async listJobsForOwner(owner: User, query: ListConcertSyncJobsDto) {
    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.owner', 'owner')
      .where('job.owner_id = :ownerId', { ownerId: owner.id })
      .orderBy('job.createdAt', 'DESC')
      .take(query.limit)
      .skip(query.offset);

    if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }

    const [jobs, total] = await qb.getManyAndCount();

    return {
      total,
      items: jobs.map((job) => this.formatJob(job)),
    };
  }

  async getJobForOwner(id: string, owner: User) {
    const job = await this.findOwnerJob(id, owner.id);

    const recentMappings = await this.syncEventRepository.find({
      where: { lastJob: { id: job.id }, owner: { id: owner.id } },
      order: { updatedAt: 'DESC' },
      take: 10,
      relations: { concert: true },
    });

    return {
      ...this.formatJob(job),
      recentEvents: recentMappings.map((mapping) => ({
        calendarEventId: mapping.calendarEventId,
        concertId: mapping.concert?.id ?? null,
        concertTitle: mapping.concert?.title ?? null,
        extractionConfidence: mapping.extractionConfidence ?? null,
        needsGuidance: mapping.needsGuidance,
        extractionWarnings: mapping.extractionWarnings,
        updatedAt: mapping.updatedAt,
      })),
    };
  }

  private async runJob(
    jobId: string,
    options: {
      accessToken?: string;
      customPrompt?: string;
      customContext?: string;
      sampleEvents?: GoogleCalendarEvent[];
      dryRun?: boolean;
      maxEvents?: number;
    },
  ): Promise<void> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: { owner: true },
    });

    if (!job) {
      return;
    }

    try {
      job.status = 'processing';
      job.startedAt = new Date();
      job.errorMessage = null;
      await this.jobRepository.save(job);

      const page = await this.loadSourceEvents(job, options);

      job.calendarTimezone = page.timeZone || job.calendarTimezone;
      job.totalEventsFetched = page.items.length;
      await this.jobRepository.save(job);

      const processableEvents = page.items.filter((event) =>
        this.isProcessableEvent(event),
      );
      const liveEvents = processableEvents.slice(0, options.maxEvents);
      const eventsLimited = processableEvents.length > liveEvents.length;
      if (!liveEvents.length) {
        job.status = 'completed';
        job.completedAt = new Date();
        job.jobMetadata = {
          ...(job.jobMetadata || {}),
          eventsLimited,
          processableEvents: processableEvents.length,
        };
        await this.jobRepository.save(job);
        return;
      }

      if (options.dryRun) {
        job.eventsProcessed = liveEvents.length;
        job.eventsSkipped = Math.max(
          0,
          processableEvents.length - liveEvents.length,
        );
        job.status = 'completed';
        job.completedAt = new Date();
        job.jobMetadata = {
          ...(job.jobMetadata || {}),
          dryRun: true,
          eventsLimited,
          processableEvents: processableEvents.length,
          dryRunEvents: liveEvents.slice(0, 10).map((event) => ({
            id: event.id,
            summary: event.summary ?? null,
            sanitizedEvent:
              this.geminiExtractor.getSanitizedEventPreview(event),
            promptPreview: this.geminiExtractor.buildPromptPreview(event, {
              customPrompt: options.customPrompt,
              customContext: options.customContext,
            }),
          })),
        };
        await this.jobRepository.save(job);
        return;
      }

      const mappingByEventId = await this.fetchMappingsForEvents(
        job.owner.id,
        job.calendarId,
        liveEvents.map((event) => event.id),
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let processed = 0;
      const extractionWarnings = new Set<string>();
      const fallbackReasons = new Map<string, number>();
      let geminiExtractions = 0;
      let heuristicExtractions = 0;

      for (const event of liveEvents) {
        const eventFingerprint = this.buildEventFingerprint(event);
        const existingMapping = mappingByEventId.get(event.id);

        if (existingMapping?.eventFingerprint === eventFingerprint) {
          skipped += 1;
          processed += 1;
          existingMapping.lastJob = job;
          existingMapping.lastSyncedAt = new Date();
          await this.syncEventRepository.save(existingMapping);
          continue;
        }

        const extraction = await this.geminiExtractor.extractConcert(event, {
          customPrompt: options.customPrompt,
          customContext: options.customContext,
        });
        if (extraction.extractionSource === 'gemini') {
          geminiExtractions += 1;
        } else {
          heuristicExtractions += 1;
          if (extraction.fallbackReason) {
            fallbackReasons.set(
              extraction.fallbackReason,
              (fallbackReasons.get(extraction.fallbackReason) ?? 0) + 1,
            );
          }
        }

        const { concert, wasCreated } = await this.upsertConcertFromEvent(
          job.owner,
          extraction,
          existingMapping?.concert?.id,
        );

        await this.upsertSyncMapping({
          owner: job.owner,
          job,
          event,
          eventFingerprint,
          extraction,
          concert,
          mapping: existingMapping,
        });

        if (extraction.needsGuidance) {
          extraction.guidanceQuestions.forEach((question) =>
            extractionWarnings.add(question),
          );
        }

        if (wasCreated) {
          created += 1;
        } else {
          updated += 1;
        }
        processed += 1;
      }

      job.eventsCreated = created;
      job.eventsUpdated = updated;
      job.eventsSkipped = skipped;
      job.eventsProcessed = processed;

      job.status = 'completed';
      job.jobMetadata = {
        ...(job.jobMetadata || {}),
        eventsLimited,
        processableEvents: processableEvents.length,
        geminiExtractions,
        heuristicExtractions,
        fallbackReasons: Object.fromEntries(fallbackReasons),
        extractionWarnings: Array.from(extractionWarnings).slice(0, 20),
      };

      if (job.refreshTopPicks) {
        const topPicksResult = await this.refreshTopPicks(job.owner.id, {
          horizonDays: 90,
          limit: 100,
          onlyUpcoming: true,
        });

        job.jobMetadata = {
          ...(job.jobMetadata || {}),
          topPicksRefresh: topPicksResult,
        };
      }

      job.completedAt = new Date();
      await this.jobRepository.save(job);
    } catch (error) {
      await this.jobRepository.update(job.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Unknown concert sync failure',
      });
    }
  }

  private async refreshTopPicks(ownerId: number, dto: RefreshTopPicksDto = {}) {
    const horizonDays = dto.horizonDays ?? 90;
    const limit = dto.limit ?? 100;
    const onlyUpcoming = dto.onlyUpcoming ?? true;
    const horizonEnd = new Date();
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

    await this.concertRepository
      .createQueryBuilder()
      .update(Concert)
      .set({
        isTopPick: false,
        topPickScore: null,
        topPickRefreshedAt: new Date(),
      })
      .where('owner_id = :ownerId', { ownerId })
      .execute();

    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.owner_id = :ownerId', { ownerId })
      .andWhere('concert.isAdminApproved = true')
      .leftJoin('concert_upvotes', 'upvote', 'upvote.concert_id = concert.id')
      .addSelect('COUNT(DISTINCT upvote.id)', 'upvote_count')
      .groupBy('concert.id')
      .orderBy('concert.startsAt', 'ASC');

    if (onlyUpcoming) {
      qb.andWhere('concert.startsAt >= :now', {
        now: new Date().toISOString(),
      });
    }

    qb.andWhere('concert.startsAt <= :horizonEnd', {
      horizonEnd: horizonEnd.toISOString(),
    });

    const { entities, raw } = await qb.getRawAndEntities();
    if (!entities.length) {
      return {
        evaluated: 0,
        topPicks: 0,
        horizonDays,
      };
    }

    const upvoteMap = new Map<string, number>(
      raw.map((entry) => {
        const typedEntry = entry as Record<string, unknown>;
        return [
          String(typedEntry.concert_id),
          Number(typedEntry.upvote_count ?? 0),
        ];
      }),
    );

    const now = Date.now();
    const ranked = entities
      .map((concert) => {
        const startsAtMillis = concert.startsAt?.getTime() ?? now;
        const daysUntil = Math.max(
          0,
          (startsAtMillis - now) / (1000 * 60 * 60 * 24),
        );
        const freshnessScore = 1 / (1 + daysUntil / 14);
        const upvoteScore = Math.log2(1 + (upvoteMap.get(concert.id) ?? 0));
        const score = Number(
          (freshnessScore * 0.6 + upvoteScore * 0.4).toFixed(4),
        );

        return {
          concert,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const topConcertIds = new Set(
      ranked.slice(0, Math.min(limit, 50)).map((row) => row.concert.id),
    );

    for (const row of ranked) {
      row.concert.isTopPick = topConcertIds.has(row.concert.id);
      row.concert.topPickScore = row.score;
      row.concert.topPickRefreshedAt = new Date();
    }

    await this.concertRepository.save(ranked.map((row) => row.concert));

    return {
      evaluated: ranked.length,
      topPicks: topConcertIds.size,
      horizonDays,
    };
  }

  private async loadSourceEvents(
    job: ConcertSyncJob,
    options: {
      accessToken?: string;
      sampleEvents?: GoogleCalendarEvent[];
    },
  ) {
    if (options.sampleEvents?.length) {
      return {
        items: options.sampleEvents,
        timeZone: 'UTC',
      };
    }

    if (this.isPublicCalendarUrl(job.calendarId)) {
      return this.icalCalendarClient.fetchAllEvents({
        url: job.calendarId,
        timeMin: job.requestedRangeStart?.toISOString(),
        timeMax: job.requestedRangeEnd?.toISOString(),
      });
    }

    const accessToken =
      options.accessToken?.trim() || this.getConfiguredCalendarAccessToken();

    if (!accessToken && !this.calendarClient.hasConfiguredServerCredential()) {
      throw new BadRequestException(
        'Google Calendar access is not configured for google_calendar sync runs.',
      );
    }

    return this.calendarClient.fetchAllEvents({
      accessToken,
      calendarId: job.calendarId,
      timeMin: job.requestedRangeStart?.toISOString(),
      timeMax: job.requestedRangeEnd?.toISOString(),
    });
  }

  private resolveMaxEvents(requestedMaxEvents?: number) {
    const configured = Number(
      this.configService.get<string>('CONCERT_SYNC_MAX_EVENTS_PER_JOB'),
    );
    const fallback = Number.isFinite(configured) ? configured : 25;
    const value = requestedMaxEvents ?? fallback;
    return Math.min(Math.max(Math.trunc(value), 1), 100);
  }

  private getConfiguredCalendarAccessToken() {
    return this.configService
      .get<string>('GOOGLE_CALENDAR_ACCESS_TOKEN')
      ?.trim();
  }

  private isPublicCalendarUrl(value: string) {
    return /^https?:\/\//i.test(value.trim());
  }

  private async upsertConcertFromEvent(
    owner: User,
    extraction: ConcertExtractionResult,
    existingConcertId?: string,
  ) {
    let concert = existingConcertId
      ? await this.concertRepository.findOne({
          where: { id: existingConcertId, owner: { id: owner.id } },
        })
      : null;

    if (!concert) {
      concert = await this.findLikelyDuplicateConcert(owner, extraction);
    }

    const wasCreated = !concert;

    const firstVenue = extraction.venues?.[0];
    const resolvedVenue = firstVenue
      ? await this.venueService.findOrCreateByName(
          firstVenue.name,
          firstVenue.city || undefined,
          firstVenue.state || undefined,
        )
      : null;

    const artistNames = extraction.artists?.map((a) => a.name) || [];
    if (artistNames.length === 0) {
      artistNames.push(extraction.title);
    }
    const resolvedBands = await this.bandService.findOrCreateManyByName(artistNames);

    const mappedLineup = resolvedBands.map((band, index) => {
      const cbl = new ConcertBandLineup();
      if (concert && concert.id) {
        cbl.concertId = concert.id;
      }
      cbl.bandId = band.id;
      cbl.band = band;
      cbl.performanceRole = PerformanceRole.HEADLINER;
      cbl.performanceOrder = index;
      return cbl;
    });

    if (!concert) {
      concert = this.concertRepository.create({
        owner,
        title: extraction.title,
        genre: extraction.genre,
        startsAt: new Date(extraction.startsAt),
        endsAt: extraction.endsAt ? new Date(extraction.endsAt) : null,
        venue: resolvedVenue,
        lineup: mappedLineup,
        description: extraction.description ?? null,
      });
    } else {
      await this.concertRepository.manager.delete(ConcertBandLineup, { concertId: concert.id });
      concert.title = extraction.title;
      concert.genre = extraction.genre;
      concert.startsAt = new Date(extraction.startsAt);
      concert.endsAt = extraction.endsAt ? new Date(extraction.endsAt) : null;
      concert.venue = resolvedVenue;
      concert.lineup = mappedLineup;
      concert.description = extraction.description ?? null;
    }

    const saved = await this.concertRepository.save(concert);

    return {
      concert: saved,
      wasCreated,
    };
  }

  private async findLikelyDuplicateConcert(
    owner: User,
    extraction: ConcertExtractionResult,
  ) {
    const startsAt = new Date(extraction.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return null;
    }

    const windowStart = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
    const windowEnd = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const normalizedTitle = this.normalizeDuplicateText(extraction.title);
    const venueName = this.normalizeDuplicateText(extraction.venues[0]?.name);

    const candidates = await this.concertRepository.find({
      where: {
        owner: { id: owner.id },
        startsAt: Between(windowStart, windowEnd),
      },
      take: 25,
    });

    return (
      candidates.find((candidate) => {
        if (this.normalizeDuplicateText(candidate.title) !== normalizedTitle) {
          return false;
        }

        const candidateVenue = this.normalizeDuplicateText(
          candidate.venue?.name,
        );
        return this.hasVenueOverlap(candidateVenue, venueName);
      }) ?? null
    );
  }

  private normalizeDuplicateText(value?: string | null) {
    return (value ?? '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private hasVenueOverlap(left: string, right: string) {
    if (!left || !right) return false;
    if (left === right) return true;
    if (left.includes(right) || right.includes(left)) return true;

    const leftTokens = new Set(
      left.split(' ').filter((token) => token.length >= 4),
    );
    const rightTokens = right.split(' ').filter((token) => token.length >= 4);
    if (!leftTokens.size || !rightTokens.length) return false;

    const matches = rightTokens.filter((token) => leftTokens.has(token)).length;
    return matches / Math.max(leftTokens.size, rightTokens.length) >= 0.6;
  }

  private async upsertSyncMapping(params: {
    owner: User;
    job: ConcertSyncJob;
    event: GoogleCalendarEvent;
    eventFingerprint: string;
    extraction: ConcertExtractionResult;
    concert: Concert;
    mapping?: ConcertSyncEvent;
  }) {
    const mapping =
      params.mapping ??
      this.syncEventRepository.create({
        owner: params.owner,
        calendarId: params.job.calendarId,
        calendarEventId: params.event.id,
      });

    mapping.concert = params.concert;
    mapping.lastJob = params.job;
    mapping.eventFingerprint = params.eventFingerprint;
    mapping.sourceUpdatedAt = params.event.updated
      ? new Date(params.event.updated)
      : null;
    mapping.lastSyncedAt = new Date();
    mapping.extractionConfidence = params.extraction.confidence;
    mapping.needsGuidance = params.extraction.needsGuidance;
    mapping.extractionWarnings = params.extraction.guidanceQuestions;
    mapping.rawEvent = params.event as unknown as Record<string, unknown>;

    await this.syncEventRepository.save(mapping);
  }

  private async fetchMappingsForEvents(
    ownerId: number,
    calendarId: string,
    eventIds: string[],
  ) {
    if (!eventIds.length) {
      return new Map<string, ConcertSyncEvent>();
    }

    const mappings = await this.syncEventRepository.find({
      where: {
        owner: { id: ownerId },
        calendarId,
        calendarEventId: In(eventIds),
      },
      relations: { concert: true },
    });

    return new Map(
      mappings.map((mapping) => [mapping.calendarEventId, mapping]),
    );
  }

  private buildEventFingerprint(event: GoogleCalendarEvent): string {
    const payload = {
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      updated: event.updated,
    };

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private isProcessableEvent(event: GoogleCalendarEvent) {
    if (!event?.id) return false;
    if (event.status === 'cancelled') return false;

    const start = event.start?.dateTime || event.start?.date;
    if (!start) return false;

    return true;
  }

  private async findOwnerJob(id: string, ownerId: number) {
    const job = await this.jobRepository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true },
    });

    if (!job) {
      throw new NotFoundException(`Concert sync job ${id} not found`);
    }

    return job;
  }

  private formatJob(job: ConcertSyncJob) {
    return {
      id: job.id,
      status: job.status as SyncJobStatus,
      performedByUserId: job.owner?.id ?? null,
      performedByUserEmail: job.owner?.email ?? null,
      calendarId: job.calendarId,
      calendarTimezone: job.calendarTimezone ?? null,
      requestedRangeStart: job.requestedRangeStart,
      requestedRangeEnd: job.requestedRangeEnd,
      refreshTopPicks: job.refreshTopPicks,
      totalEventsFetched: job.totalEventsFetched,
      eventsProcessed: job.eventsProcessed,
      eventsCreated: job.eventsCreated,
      eventsUpdated: job.eventsUpdated,
      eventsSkipped: job.eventsSkipped,
      errorMessage: job.errorMessage ?? null,
      metadata: job.jobMetadata,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
