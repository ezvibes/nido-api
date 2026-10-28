import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { ConcertUpload } from '../entities/concert-upload.entity';
import { Concert, ConcertCatalogStatus } from '../../apis/concerts/entities/concert.entity';
import { ConcertBandLineup, PerformanceRole } from '../../apis/concerts/entities/concert-band-lineup.entity';
import { Venue } from '../../apis/venues/entities/venue.entity';
import { Band } from '../../apis/bands/entities/band.entity';
import { IngestionStage } from '../interfaces/ingestion-enums';

export interface PublishCandidateDto {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or HH:mm:ss
  venueId?: string;
  venueName?: string;
  bandIds: string[];
  bandNames?: string[];
  genreIds: string[];
  genre?: string;
  notes?: string;
  reviewDurationMs: number;
}

export interface DuplicateDecisionDto {
  decision: 'link' | 'merge' | 'publish_separately' | 'reject';
  targetConcertId?: string; // required for link and merge
  publishData?: PublishCandidateDto; // required for publish_separately or merge
  reviewDurationMs: number;
  rejectReason?: string;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

@Injectable()
export class IngestionPublicationService {
  private readonly logger = new Logger(IngestionPublicationService.name);

  constructor(
    private readonly dataSource: DataSource,
  ) {}

  private buildStartsAt(dateStr: string, timeStr?: string): Date {
    const cleanDate = (dateStr || '').trim().slice(0, 10);
    const rawTime = (timeStr || '19:00').trim();
    const timeParts = rawTime.split(':');
    const hh = (timeParts[0] || '19').padStart(2, '0');
    const mm = (timeParts[1] || '00').padStart(2, '0');
    const ss = (timeParts[2] || '00').slice(0, 2).padStart(2, '0');
    const parsed = new Date(`${cleanDate}T${hh}:${mm}:${ss}Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid concert date/time: ${dateStr} ${timeStr}`);
    }
    return parsed;
  }

  private async resolveVenueIdInTx(
    manager: EntityManager,
    dto: PublishCandidateDto,
    candidate: IngestionCandidate,
    upload?: ConcertUpload | null,
  ): Promise<string | null> {
    if (dto.venueId?.trim()) {
      return dto.venueId.trim();
    }
    if (candidate.suggestedVenueId?.trim()) {
      return candidate.suggestedVenueId.trim();
    }
    const venueName =
      dto.venueName?.trim() ||
      candidate.provenance?.venueExtracted?.rawValue?.trim() ||
      candidate.provenance?.venue?.rawValue?.trim();
    if (!venueName) {
      return upload?.venueId ?? null;
    }

    const venueRepo = manager.getRepository(Venue);
    const cleanCity =
      candidate.provenance?.venueExtracted?.normalizedValue?.city?.trim() ||
      upload?.city?.trim() ||
      'Unknown City';
    const cleanState =
      candidate.provenance?.venueExtracted?.normalizedValue?.state?.trim() ||
      upload?.state?.trim() ||
      'NC';
    const citySlug = slugify(cleanCity) || 'unknown-city';

    const existing = await venueRepo.findOne({
      where: { name: venueName, citySlug },
    });
    if (existing) {
      return existing.id;
    }

    const created = await venueRepo.save(
      venueRepo.create({
        name: venueName,
        city: cleanCity,
        citySlug,
        region: cleanState,
        regionSlug: slugify(cleanState) || 'nc',
      }),
    );
    return created.id;
  }

  private async resolveBandIdsInTx(
    manager: EntityManager,
    dto: PublishCandidateDto,
    candidate: IngestionCandidate,
  ): Promise<string[]> {
    if (Array.isArray(dto.bandNames) && dto.bandNames.length > 0) {
      const bandRepo = manager.getRepository(Band);
      const resolvedIds: string[] = [];
      for (const rawName of dto.bandNames) {
        const name = rawName?.trim();
        if (!name) continue;
        const baseSlug = slugify(name) || 'band';
        let existing: Band | null = null;
        if (typeof bandRepo.createQueryBuilder === 'function') {
          existing = await bandRepo
            .createQueryBuilder('band')
            .where('LOWER(band.name) = LOWER(:name)', { name })
            .getOne();
        }
        if (!existing) {
          existing = await bandRepo.findOne({ where: { slug: baseSlug } });
        }

        if (existing && existing.name?.toLowerCase() === name.toLowerCase()) {
          if (!resolvedIds.includes(existing.id)) {
            resolvedIds.push(existing.id);
          }
        } else {
          let uniqueSlug = baseSlug;
          let counter = 1;
          while (existing && existing.slug === uniqueSlug) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
            existing = await bandRepo.findOne({ where: { slug: uniqueSlug } });
          }
          const saved = await bandRepo.save(
            bandRepo.create({
              name,
              slug: uniqueSlug,
              genres: [],
            }),
          );
          if (saved?.id && !resolvedIds.includes(saved.id)) {
            resolvedIds.push(saved.id);
          }
        }
      }
      if (resolvedIds.length > 0) {
        return resolvedIds;
      }
    }

    if (Array.isArray(dto.bandIds) && dto.bandIds.length > 0) {
      return Array.from(new Set(dto.bandIds.filter(Boolean)));
    }

    if (Array.isArray(candidate.suggestedBandIds) && candidate.suggestedBandIds.length > 0) {
      return Array.from(new Set(candidate.suggestedBandIds.filter(Boolean)));
    }

    return [];
  }

  async publishCandidate(
    candidateId: string,
    dto: PublishCandidateDto,
    reviewedByUserId: number,
  ): Promise<{ publishedConcertId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const candidate = await this.lockCandidate(manager, candidateId);
      return this.publishLockedCandidateInTx(
        manager,
        candidate,
        dto,
        reviewedByUserId,
        'publish',
      );
    });
  }

  private async publishLockedCandidateInTx(
    manager: EntityManager,
    candidate: IngestionCandidate,
    dto: PublishCandidateDto,
    reviewedByUserId: number,
    decisionLabel: 'publish' | 'publish_separately' = 'publish',
    preloadedJob?: IngestionJob | null,
  ): Promise<{ publishedConcertId: string }> {
    if (candidate.status === 'published' && candidate.publishedConcertId) {
      return { publishedConcertId: candidate.publishedConcertId };
    }

    if (candidate.status !== 'pending') {
      throw new ConflictException(`Candidate ${candidate.id} cannot be published, status is ${candidate.status}`);
    }

    const job =
      preloadedJob ??
      (await manager.findOne(IngestionJob, {
        where: { id: candidate.ingestionJobId },
        relations: { concertUpload: true },
      }));
    if (!job) {
      throw new NotFoundException(`Job for candidate ${candidate.id} not found`);
    }

    const startsAt = this.buildStartsAt(dto.date, dto.time);
    const resolvedVenueId = await this.resolveVenueIdInTx(
      manager,
      dto,
      candidate,
      job.concertUpload,
    );
    const resolvedBandIds = await this.resolveBandIdsInTx(manager, dto, candidate);
    const resolvedGenre =
      dto.genre?.trim() ||
      dto.genreIds?.[0]?.trim() ||
      candidate.provenance?.genres?.rawValue?.trim() ||
      job.concertUpload?.genre?.trim() ||
      'Live Music';

    // 3. Create canonical Concert entity
    const concertRepository = manager.getRepository(Concert);

    const newConcert = concertRepository.create({
      owner: { id: job.concertUpload?.uploadedByUserId || reviewedByUserId } as any,
      title: dto.title,
      genre: resolvedGenre,
      venueId: resolvedVenueId ?? undefined,
      venue: resolvedVenueId ? ({ id: resolvedVenueId } as any) : null,
      startsAt,
      description: dto.notes?.trim() || null,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isAdminApproved: true,
      adminApprovedAt: new Date(),
      adminApprovedByUserId: reviewedByUserId,
      version: 1,
    });
    const savedConcert = await concertRepository.save(newConcert);

    // Create lineup
    if (resolvedBandIds.length > 0) {
      const lineupRepo = manager.getRepository(ConcertBandLineup);
      const lineups = resolvedBandIds.map((bandId, index) => {
        return lineupRepo.create({
          concertId: savedConcert.id,
          bandId: bandId,
          performanceOrder: index,
          performanceRole: index === 0 ? PerformanceRole.HEADLINER : PerformanceRole.SUPPORT,
        });
      });
      await lineupRepo.save(lineups);
    }

    // Update Candidate (reviewAudit requested by Code Review)
    candidate.status = 'published';
    candidate.publishedConcertId = savedConcert.id;
    if (!candidate.provenance) candidate.provenance = {};
    candidate.provenance.reviewAudit = {
      reviewDurationMs: dto.reviewDurationMs,
      decision: decisionLabel,
      reviewedAt: new Date().toISOString(),
      reviewedByUserId,
    };
    await manager.save(candidate);

    // Update Upload
    if (job.concertUpload) {
      job.concertUpload.reviewStatus = 'approved';
      job.concertUpload.reviewNotes = dto.notes;
      job.concertUpload.reviewedAt = new Date();
      job.concertUpload.reviewedByUserId = reviewedByUserId;
      if (!job.concertUpload.concertId) {
        job.concertUpload.concertId = savedConcert.id; // Link primary poster image without overwriting earlier multi-day concert link
      }
      await manager.save(job.concertUpload);
    }

    // Update Job
    job.stage = IngestionStage.COMPLETED;
    job.status = IngestionStage.COMPLETED;
    await manager.save(job);

    return { publishedConcertId: savedConcert.id };
  }

  private async lockCandidate(manager: EntityManager, candidateId: string): Promise<IngestionCandidate> {
    const candidate = await manager.findOne(IngestionCandidate, {
      where: { id: candidateId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!candidate) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }
    return candidate;
  }

  async handleDuplicateDecision(
    candidateId: string,
    dto: DuplicateDecisionDto,
    reviewedByUserId: number,
  ): Promise<{ publishedConcertId?: string; status: string }> {
    return this.dataSource.transaction(async (manager) => {
      const candidate = await this.lockCandidate(manager, candidateId);

      if (candidate.status !== 'pending') {
        throw new ConflictException(`Candidate ${candidateId} cannot be modified, status is ${candidate.status}`);
      }

      const job = await manager.findOne(IngestionJob, {
        where: { id: candidate.ingestionJobId },
        relations: { concertUpload: true },
      });
      if (!job) {
         throw new NotFoundException(`Job for candidate ${candidateId} not found`);
      }

      if (dto.decision === 'reject') {
        candidate.status = 'rejected';
        if (!candidate.provenance) candidate.provenance = {};
        candidate.provenance.reviewAudit = {
           reviewDurationMs: dto.reviewDurationMs,
           decision: 'reject',
           rejectReason: dto.rejectReason,
           reviewedAt: new Date().toISOString(),
           reviewedByUserId
        };
        await manager.save(candidate);

        const candidateRepo = manager.getRepository(IngestionCandidate);
        const siblingCandidates =
          typeof candidateRepo.find === 'function'
            ? await candidateRepo.find({ where: { ingestionJobId: candidate.ingestionJobId } })
            : [];
        const hasPublishedSibling = siblingCandidates.some(
          (c) => c.id !== candidate.id && c.status === 'published',
        );
        const hasPendingSibling = siblingCandidates.some(
          (c) => c.id !== candidate.id && c.status === 'pending',
        );

        if (job.concertUpload && !hasPublishedSibling && !hasPendingSibling) {
           job.concertUpload.reviewStatus = 'rejected';
           job.concertUpload.reviewNotes = dto.rejectReason;
           job.concertUpload.reviewedAt = new Date();
           job.concertUpload.reviewedByUserId = reviewedByUserId;
           await manager.save(job.concertUpload);
        }

        if (!hasPendingSibling) {
          job.stage = IngestionStage.COMPLETED;
          job.status = IngestionStage.COMPLETED;
          await manager.save(job);
        }

        return { status: 'rejected' };
      }

      if (dto.decision === 'link' || dto.decision === 'merge') {
        if (!dto.targetConcertId) {
           throw new BadRequestException('targetConcertId is required for link or merge');
        }

        const concert = await manager.findOne(Concert, { where: { id: dto.targetConcertId } });
        if (!concert) {
           throw new NotFoundException(`Target concert ${dto.targetConcertId} not found`);
        }

        if (dto.decision === 'link') {
          concert.isAdminApproved = true;
          concert.adminApprovedAt = concert.adminApprovedAt || new Date();
          concert.adminApprovedByUserId = concert.adminApprovedByUserId || reviewedByUserId;
          await manager.save(concert);
        }

        if (dto.decision === 'merge' && dto.publishData) {
            const startsAt = this.buildStartsAt(dto.publishData.date, dto.publishData.time);
            const resolvedVenueId = await this.resolveVenueIdInTx(
              manager,
              dto.publishData,
              candidate,
              job.concertUpload,
            );
            const resolvedBandIds = await this.resolveBandIdsInTx(
              manager,
              dto.publishData,
              candidate,
            );

            concert.title = dto.publishData.title || concert.title;
            concert.startsAt = startsAt || concert.startsAt;
            if (dto.publishData.genre?.trim()) {
              concert.genre = dto.publishData.genre.trim();
            }
            if (resolvedVenueId) {
              concert.venueId = resolvedVenueId;
              concert.venue = { id: resolvedVenueId } as any;
            }
            concert.isAdminApproved = true;
            concert.adminApprovedAt = new Date();
            concert.adminApprovedByUserId = reviewedByUserId;
            concert.editorialLockedAt = new Date();
            await manager.save(concert);

            // Re-create lineup
            if (resolvedBandIds.length > 0) {
              const lineupRepo = manager.getRepository(ConcertBandLineup);
              if (typeof lineupRepo.delete === 'function') {
                await lineupRepo.delete({ concertId: concert.id });
              }
              const lineups = resolvedBandIds.map((bandId, index) => {
                 return lineupRepo.create({
                   concertId: concert.id,
                   bandId: bandId,
                   performanceOrder: index,
                   performanceRole: index === 0 ? PerformanceRole.HEADLINER : PerformanceRole.SUPPORT,
                 });
              });
              await lineupRepo.save(lineups);
            }
        }

        candidate.status = 'published';
        candidate.publishedConcertId = concert.id;
        if (!candidate.provenance) candidate.provenance = {};
        candidate.provenance.reviewAudit = {
           reviewDurationMs: dto.reviewDurationMs,
           decision: dto.decision,
           reviewedAt: new Date().toISOString(),
           reviewedByUserId
        };
        await manager.save(candidate);

        if (job.concertUpload) {
           job.concertUpload.reviewStatus = 'approved';
           job.concertUpload.reviewedAt = new Date();
           job.concertUpload.reviewedByUserId = reviewedByUserId;
           if (!job.concertUpload.concertId) {
             job.concertUpload.concertId = concert.id;
           }
           await manager.save(job.concertUpload);
        }

        job.stage = IngestionStage.COMPLETED;
        job.status = IngestionStage.COMPLETED;
        await manager.save(job);

        return { publishedConcertId: concert.id, status: 'published' };
      }

      if (dto.decision === 'publish_separately') {
        if (!dto.publishData) {
           throw new BadRequestException('publishData is required for publish_separately');
        }
        const { publishedConcertId } = await this.publishLockedCandidateInTx(
          manager,
          candidate,
          dto.publishData,
          reviewedByUserId,
          'publish_separately',
          job,
        );
        return { publishedConcertId, status: 'published' };
      }

      throw new BadRequestException(`Invalid decision ${dto.decision}`);
    });
  }

  async rejectCandidate(
    candidateId: string,
    reason: string,
    reviewedByUserId: number,
  ): Promise<{ status: string }> {
     return this.handleDuplicateDecision(candidateId, { decision: 'reject', rejectReason: reason, reviewDurationMs: 0 }, reviewedByUserId);
  }

  async listCandidates(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const candidateRepo = this.dataSource.getRepository(IngestionCandidate);
    const query = candidateRepo.createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.ingestionJob', 'job')
      .leftJoinAndSelect('job.concertUpload', 'upload')
      .leftJoinAndSelect('upload.uploadedByUser', 'uploader')
      .orderBy('candidate.createdAt', 'DESC')
      .take(options.limit ?? 50)
      .skip(options.offset ?? 0);

    if (options.status && options.status !== 'all') {
      query.andWhere('candidate.status = :status', { status: options.status });
    }

    const [items, total] = await query.getManyAndCount();
    return {
      total,
      items: items.map((c) => ({
        id: c.id,
        status: c.status,
        candidateIndex: c.candidateIndex,
        ingestionJobId: c.ingestionJobId,
        publishedConcertId: c.publishedConcertId,
        provenance: c.provenance,
        suggestedVenueId: c.suggestedVenueId,
        suggestedBandIds: c.suggestedBandIds,
        suggestedGenreIds: c.suggestedGenreIds,
        createdAt: c.createdAt,
        upload: c.ingestionJob?.concertUpload
          ? {
              id: c.ingestionJob.concertUpload.id,
              originalFilename: c.ingestionJob.concertUpload.originalFilename,
              city: c.ingestionJob.concertUpload.city,
              state: c.ingestionJob.concertUpload.state,
              genre: c.ingestionJob.concertUpload.genre,
              concertDate: c.ingestionJob.concertUpload.concertDate?.toISOString?.() ?? c.ingestionJob.concertUpload.concertDate,
              uploadedByUid: c.ingestionJob.concertUpload.uploadedByUid,
              uploadedByUserEmail: c.ingestionJob.concertUpload.uploadedByUser?.email,
              createdAt: c.ingestionJob.concertUpload.createdAt,
              posterUrl: `/ingestion/uploads/${c.ingestionJob.concertUpload.id}/image`,
            }
          : null,
      })),
    };
  }

  async getCandidate(candidateId: string): Promise<any> {
    const candidateRepo = this.dataSource.getRepository(IngestionCandidate);
    const candidate = await candidateRepo.findOne({
      where: { id: candidateId },
      relations: {
        ingestionJob: {
          concertUpload: {
            uploadedByUser: true,
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }

    // Search for probable duplicates in Concert catalog
    const concertRepo = this.dataSource.getRepository(Concert);
    let probableDuplicates: Concert[] = [];

    const extractedDate = candidate.provenance?.date?.rawValue;
    if (extractedDate) {
      const parsedDate = new Date(extractedDate);
      if (!isNaN(parsedDate.getTime())) {
        const startDay = new Date(parsedDate);
        startDay.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(parsedDate);
        endDay.setUTCHours(23, 59, 59, 999);

        const dupQuery = concertRepo.createQueryBuilder('concert')
          .leftJoinAndSelect('concert.venue', 'venue')
          .leftJoinAndSelect('concert.lineup', 'lineup')
          .leftJoinAndSelect('lineup.band', 'band');

        const extractedVenueName =
          candidate.provenance?.venue?.rawValue?.trim() ||
          candidate.provenance?.venueExtracted?.rawValue?.trim();
        const extractedTitle = candidate.provenance?.title?.rawValue?.trim();

        if (candidate.suggestedVenueId) {
          dupQuery.where(
            'concert.venueId = :venueId AND concert.startsAt BETWEEN :rangeStart AND :rangeEnd',
            {
              venueId: candidate.suggestedVenueId,
              rangeStart: new Date(startDay.getTime() - 24 * 60 * 60 * 1000),
              rangeEnd: new Date(endDay.getTime() + 24 * 60 * 60 * 1000),
            },
          );
          if (extractedTitle) {
            dupQuery.orWhere(
              'concert.startsAt BETWEEN :startDay AND :endDay AND LOWER(concert.title) = LOWER(:title)',
              { startDay, endDay, title: extractedTitle },
            );
          }
        } else if (extractedVenueName) {
          dupQuery.where(
            'concert.startsAt BETWEEN :startDay AND :endDay AND LOWER(venue.name) = LOWER(:venueName)',
            { startDay, endDay, venueName: extractedVenueName },
          );
          if (extractedTitle) {
            dupQuery.orWhere(
              'concert.startsAt BETWEEN :startDay AND :endDay AND LOWER(concert.title) = LOWER(:title)',
              { startDay, endDay, title: extractedTitle },
            );
          }
        } else {
          dupQuery.where('concert.startsAt BETWEEN :startDay AND :endDay', { startDay, endDay });
        }

        probableDuplicates = await dupQuery.take(5).getMany();
      }
    }

    return {
      candidate,
      probableDuplicates,
      upload: candidate.ingestionJob?.concertUpload
        ? {
            id: candidate.ingestionJob.concertUpload.id,
            originalFilename: candidate.ingestionJob.concertUpload.originalFilename,
            city: candidate.ingestionJob.concertUpload.city,
            state: candidate.ingestionJob.concertUpload.state,
            genre: candidate.ingestionJob.concertUpload.genre,
            concertDate:
              candidate.ingestionJob.concertUpload.concertDate?.toISOString?.() ??
              candidate.ingestionJob.concertUpload.concertDate,
            uploadedByUid: candidate.ingestionJob.concertUpload.uploadedByUid,
            uploadedByUserEmail: candidate.ingestionJob.concertUpload.uploadedByUser?.email,
            createdAt: candidate.ingestionJob.concertUpload.createdAt,
            posterUrl: `/ingestion/uploads/${candidate.ingestionJob.concertUpload.id}/image`,
          }
        : null,
    };
  }
}
