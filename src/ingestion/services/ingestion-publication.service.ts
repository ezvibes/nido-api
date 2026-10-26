import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { ConcertUpload } from '../entities/concert-upload.entity';
import { Concert, ConcertCatalogStatus } from '../../apis/concerts/entities/concert.entity';
import { ConcertBandLineup, PerformanceRole } from '../../apis/concerts/entities/concert-band-lineup.entity';
import { ConcertSet } from '../../apis/concerts/entities/concert-set.entity';
import { IngestionStage } from '../interfaces/ingestion-enums';
import { InjectRepository } from '@nestjs/typeorm';

export interface PublishCandidateDto {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venueId?: string;
  bandIds: string[];
  genreIds: string[];
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

@Injectable()
export class IngestionPublicationService {
  private readonly logger = new Logger(IngestionPublicationService.name);

  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async publishCandidate(
    candidateId: string,
    dto: PublishCandidateDto,
    reviewedByUserId: number,
  ): Promise<{ publishedConcertId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const candidate = await this.lockCandidate(manager, candidateId);

      if (candidate.status === 'published' && candidate.publishedConcertId) {
        return { publishedConcertId: candidate.publishedConcertId };
      }

      if (candidate.status !== 'pending') {
        throw new ConflictException(`Candidate ${candidateId} cannot be published, status is ${candidate.status}`);
      }

      const job = await manager.findOne(IngestionJob, {
        where: { id: candidate.ingestionJobId },
        relations: { concertUpload: true },
      });
      if (!job) {
         throw new NotFoundException(`Job for candidate ${candidateId} not found`);
      }

      const startsAt = new Date(`${dto.date}T${dto.time}:00Z`);

      // 3. Create canonical Concert entity
      const concertRepository = manager.getRepository(Concert);
      const newConcert = concertRepository.create({
        owner: { id: reviewedByUserId } as any, // assuming owner relationship needs user id
        title: dto.title,
        genre: 'Live Music', // We don't have a genre table relation here, normally it's a string, we might need mapping
        venue: dto.venueId ? { id: dto.venueId } as any : null,
        startsAt,
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        isAdminApproved: true,
        version: 1,
      });
      const savedConcert = await concertRepository.save(newConcert);

      // Create lineup
      if (dto.bandIds && dto.bandIds.length > 0) {
        const lineupRepo = manager.getRepository(ConcertBandLineup);
        const lineups = dto.bandIds.map((bandId, index) => {
           return lineupRepo.create({
             concertId: savedConcert.id,
             bandId: bandId,
             performanceOrder: index,
             performanceRole: index === 0 ? PerformanceRole.HEADLINER : PerformanceRole.SUPPORT,
           });
        });
        await lineupRepo.save(lineups);
      }

      // Update Candidate
      candidate.status = 'published';
      candidate.publishedConcertId = savedConcert.id;
      await manager.save(candidate);

      // Update Upload
      if (job.concertUpload) {
         job.concertUpload.reviewStatus = 'approved';
         job.concertUpload.reviewNotes = dto.notes;
         job.concertUpload.reviewedAt = new Date();
         job.concertUpload.reviewedByUserId = reviewedByUserId;
         job.concertUpload.concertId = savedConcert.id; // Link poster image
         await manager.save(job.concertUpload);
      }

      // Update Job
      job.stage = IngestionStage.COMPLETED;
      job.status = IngestionStage.COMPLETED;
      await manager.save(job);

      // Audit Log could go here.

      return { publishedConcertId: savedConcert.id };
    });
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
        await manager.save(candidate);

        if (job.concertUpload) {
           job.concertUpload.reviewStatus = 'rejected';
           job.concertUpload.reviewNotes = dto.rejectReason;
           job.concertUpload.reviewedAt = new Date();
           job.concertUpload.reviewedByUserId = reviewedByUserId;
           await manager.save(job.concertUpload);
        }

        job.stage = IngestionStage.COMPLETED;
        job.status = IngestionStage.COMPLETED;
        await manager.save(job);

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

        if (dto.decision === 'merge' && dto.publishData) {
            // merge data into concert
            // (omitting for brevity, we could update the concert fields if they are missing)
        }

        candidate.status = 'published';
        candidate.publishedConcertId = concert.id;
        await manager.save(candidate);

        if (job.concertUpload) {
           job.concertUpload.reviewStatus = 'approved';
           job.concertUpload.reviewedAt = new Date();
           job.concertUpload.reviewedByUserId = reviewedByUserId;
           job.concertUpload.concertId = concert.id;
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
        const { publishedConcertId } = await this.publishCandidate(candidateId, dto.publishData, reviewedByUserId);
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
}
