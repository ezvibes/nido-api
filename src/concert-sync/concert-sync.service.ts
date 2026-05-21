import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
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
    private readonly geminiExtractor: GeminiConcertExtractorService,
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
    if (!dto.googleAccessToken && !sampleEvents?.length) {
      throw new BadRequestException(
        'googleAccessToken is required unless sampleEvents are supplied.',
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
          sampleMode: Boolean(sampleEvents?.length),
          syncSource: sampleEvents?.length ? 'sample_events' : 'google_calendar',
        },
      }),
    );

    void this.runJob(job.id, {
      accessToken: dto.googleAccessToken,
      customPrompt: dto.geminiPrompt,
      customContext: dto.geminiContext,
      sampleEvents: sampleEvents as GoogleCalendarEvent[] | undefined,
    });

    return this.formatJob(job);
  }

  async listJobsForOwner(owner: User, query: ListConcertSyncJobsDto) {
    const qb = this.jobRepository
      .createQueryBuilder('job')
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
        extractionConfidence: mapping.extractionConfidence ?? null,
        needsGuidance: mapping.needsGuidance,
        extractionWarnings: mapping.extractionWarnings,
        updatedAt: mapping.updatedAt,
      })),
    };
  }

  async refreshTopPicksForOwner(owner: User, dto: RefreshTopPicksDto = {}) {
    const refreshed = await this.refreshTopPicks(owner.id, dto);

    return {
      refreshedAt: new Date().toISOString(),
      ...refreshed,
    };
  }

  async listTopPicksForOwner(owner: User, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const concerts = await this.concertRepository.find({
      where: { owner: { id: owner.id }, isTopPick: true },
      order: {
        topPickScore: 'DESC',
        startsAt: 'ASC',
      },
      take: safeLimit,
    });

    return {
      total: concerts.length,
      items: concerts,
    };
  }

  getGeminiPromptTemplate() {
    const extractionPolicy = this.geminiExtractor.getExtractionPolicy();
    return {
      template: this.geminiExtractor.getPromptTemplate(),
      extractionPolicy,
      dataPolicy: {
        sourceOfTruth: 'google_calendar',
        redactions: ['email', 'phone', 'urls', 'attendees', 'organizer'],
        transmittedFields: [
          'id',
          'status',
          'summary',
          'description',
          'location',
          'start',
          'end',
          'updated',
          'created',
        ],
      },
    };
  }

  previewGeminiPrompt(params: {
    event: Record<string, unknown>;
    geminiPrompt?: string;
    geminiContext?: string;
  }) {
    const event = this.toGoogleCalendarEvent(params.event);
    return {
      prompt: this.geminiExtractor.buildPromptPreview(event, {
        customPrompt: params.geminiPrompt,
        customContext: params.geminiContext,
      }),
      sanitizedEvent: this.geminiExtractor.getSanitizedEventPreview(event),
    };
  }

  private async runJob(
    jobId: string,
    options: {
      accessToken?: string;
      customPrompt?: string;
      customContext?: string;
      sampleEvents?: GoogleCalendarEvent[];
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

      const liveEvents = page.items.filter((event) =>
        this.isProcessableEvent(event),
      );
      if (!liveEvents.length) {
        job.status = 'completed';
        job.completedAt = new Date();
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
    if (!options.accessToken?.trim()) {
      throw new BadRequestException(
        'googleAccessToken is required for google_calendar sync runs.',
      );
    }

    return this.calendarClient.fetchAllEvents({
      accessToken: options.accessToken,
      calendarId: job.calendarId,
      timeMin: job.requestedRangeStart?.toISOString(),
      timeMax: job.requestedRangeEnd?.toISOString(),
    });
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

    const wasCreated = !concert;

    if (!concert) {
      concert = this.concertRepository.create({
        owner,
        title: extraction.title,
        genre: extraction.genre,
        startsAt: new Date(extraction.startsAt),
        endsAt: extraction.endsAt ? new Date(extraction.endsAt) : null,
        venues: extraction.venues,
        artists: extraction.artists,
        description: extraction.description ?? null,
      });
    } else {
      concert.title = extraction.title;
      concert.genre = extraction.genre;
      concert.startsAt = new Date(extraction.startsAt);
      concert.endsAt = extraction.endsAt ? new Date(extraction.endsAt) : null;
      concert.venues = extraction.venues;
      concert.artists = extraction.artists;
      concert.description = extraction.description ?? null;
    }

    const saved = await this.concertRepository.save(concert);

    return {
      concert: saved,
      wasCreated,
    };
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

  private toGoogleCalendarEvent(payload: Record<string, unknown>): GoogleCalendarEvent {
    const start = this.toDateTimePayload(payload.start);
    const end = this.toDateTimePayload(payload.end);

    return {
      id:
        (typeof payload.id === 'string' && payload.id.trim()) ||
        `preview-${Date.now()}`,
      status: typeof payload.status === 'string' ? payload.status : undefined,
      summary: typeof payload.summary === 'string' ? payload.summary : undefined,
      description:
        typeof payload.description === 'string' ? payload.description : undefined,
      location:
        typeof payload.location === 'string' ? payload.location : undefined,
      updated: typeof payload.updated === 'string' ? payload.updated : undefined,
      created: typeof payload.created === 'string' ? payload.created : undefined,
      start,
      end,
    };
  }

  private toDateTimePayload(value: unknown) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    return {
      dateTime:
        typeof record.dateTime === 'string' ? record.dateTime : undefined,
      date: typeof record.date === 'string' ? record.date : undefined,
      timeZone:
        typeof record.timeZone === 'string' ? record.timeZone : undefined,
    };
  }
}
