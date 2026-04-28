import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { IngestionParserService } from '../parser/ingestion-parser.service';
import { IngestionStorageService } from '../storage/ingestion-storage.service';
import { VisionOcrService } from '../ocr/vision-ocr.service';

export interface ProcessedIngestionJobResult {
  jobId: string;
  status: string;
  stage?: string;
  errorMessage?: string;
}

@Injectable()
export class IngestionWorkerService {
  private readonly logger = new Logger(IngestionWorkerService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
    @InjectRepository(IngestionCandidate)
    private readonly ingestionCandidateRepository: Repository<IngestionCandidate>,
    private readonly ingestionStorageService: IngestionStorageService,
    private readonly visionOcrService: VisionOcrService,
    private readonly ingestionParserService: IngestionParserService,
  ) {}

  async processNextQueuedJob(): Promise<ProcessedIngestionJobResult | null> {
    const claimedJob = await this.claimNextQueuedJob();

    if (!claimedJob) {
      return null;
    }

    return this.processClaimedJob(claimedJob.id);
  }

  async processJobById(id: string): Promise<ProcessedIngestionJobResult> {
    const claimedJob = await this.claimQueuedJobById(id);

    if (claimedJob) {
      return this.processClaimedJob(claimedJob.id);
    }

    const existingJob = await this.findJobById(id);

    if (!existingJob) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    if (existingJob.status === 'processing') {
      return {
        jobId: existingJob.id,
        status: existingJob.status,
        stage: existingJob.stage,
        errorMessage: existingJob.errorMessage,
      };
    }

    return {
      jobId: existingJob.id,
      status: existingJob.status,
      stage: existingJob.stage,
      errorMessage: existingJob.errorMessage,
    };
  }

  private async claimNextQueuedJob(): Promise<IngestionJob | null> {
    const queuedJob = await this.ingestionJobRepository.findOne({
      where: { status: 'queued' },
      relations: { sourceAsset: true },
      order: { createdAt: 'ASC' },
    });

    if (!queuedJob) {
      return null;
    }

    const claimResult = await this.ingestionJobRepository.update(
      { id: queuedJob.id, status: 'queued' },
      {
        status: 'processing',
        stage: 'ocr',
        processingStartedAt: new Date(),
        completedAt: undefined,
        failedAt: undefined,
        errorMessage: undefined,
        ocrText: undefined,
        ocrProvider: undefined,
        ocrConfidence: undefined,
      },
    );

    if (!claimResult.affected) {
      return null;
    }

    return this.findJobById(queuedJob.id);
  }

  private async claimQueuedJobById(id: string): Promise<IngestionJob | null> {
    const claimResult = await this.ingestionJobRepository.update(
      { id, status: 'queued' },
      {
        status: 'processing',
        stage: 'ocr',
        processingStartedAt: new Date(),
        completedAt: undefined,
        failedAt: undefined,
        errorMessage: undefined,
        ocrText: undefined,
        ocrProvider: undefined,
        ocrConfidence: undefined,
      },
    );

    if (!claimResult.affected) {
      return null;
    }

    return this.findJobById(id);
  }

  private async processClaimedJob(
    id: string,
  ): Promise<ProcessedIngestionJobResult> {
    const job = await this.findJobById(id);
    let ocrSucceeded = false;

    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    if (!job.sourceAsset) {
      return this.markFailed(job.id, 'Job is missing its linked source asset.');
    }

    try {
      const objectExists = await this.ingestionStorageService.objectExists(
        job.sourceAsset.bucket,
        job.sourceAsset.objectName,
      );

      if (!objectExists) {
        return this.markFailed(
          job.id,
          `Source asset gs://${job.sourceAsset.bucket}/${job.sourceAsset.objectName} was not found.`,
        );
      }

      const ocrResult = await this.visionOcrService.extractText(
        job.sourceAsset.bucket,
        job.sourceAsset.objectName,
      );

      await this.ingestionJobRepository.update(job.id, {
        stage: 'parsing',
        ocrProvider: ocrResult.provider,
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
      });
      ocrSucceeded = true;

      const parsedCandidates = this.ingestionParserService.parseOcrText(ocrResult.text, {
        city: job.sourceAsset.city,
      });

      const persistedCandidates = await this.ingestionCandidateRepository.save(
        parsedCandidates.map((candidate) =>
          this.ingestionCandidateRepository.create({
            ingestionJobId: job.id,
            ingestionJob: job,
            sourceAssetId: job.sourceAssetId,
            sourceAsset: job.sourceAsset,
            status: candidate.status,
            title: candidate.title,
            description: candidate.description,
            startAt: candidate.startAt,
            endAt: candidate.endAt,
            venueName: candidate.venueName,
            city: candidate.city,
            region: candidate.region,
            artistNames: candidate.artistNames,
            genreHints: candidate.genreHints,
            parserVersion: candidate.parserVersion,
            parseConfidence: candidate.parseConfidence,
            parseWarnings: candidate.parseWarnings,
            rawExtractedFields: candidate.rawExtractedFields,
            rawOcrText: candidate.rawOcrText,
          }),
        ),
      );

      await this.ingestionJobRepository.update(job.id, {
        status: persistedCandidates.length ? 'needs_review' : 'parsed',
        stage: 'parsed',
        errorMessage: undefined,
        failedAt: undefined,
        completedAt: new Date(),
      });

      this.logger.log(
        `Parsed ingestion job ${job.id} and created ${persistedCandidates.length} candidate(s)`,
      );

      return {
        jobId: job.id,
        status: persistedCandidates.length ? 'needs_review' : 'parsed',
        stage: 'parsed',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown OCR worker failure.';
      return this.markFailed(job.id, message, {
        preserveOcrFields: ocrSucceeded,
      });
    }
  }

  private async markFailed(
    jobId: string,
    errorMessage: string,
    options?: { preserveOcrFields?: boolean },
  ): Promise<ProcessedIngestionJobResult> {
    await this.ingestionJobRepository.update(jobId, {
      status: 'failed',
      stage: 'failed',
      errorMessage,
      completedAt: undefined,
      failedAt: new Date(),
      ...(options?.preserveOcrFields
        ? {}
        : {
            ocrText: undefined,
            ocrProvider: undefined,
            ocrConfidence: undefined,
          }),
    });

    this.logger.warn(`Failed ingestion job ${jobId}: ${errorMessage}`);

    return {
      jobId,
      status: 'failed',
      stage: 'failed',
      errorMessage,
    };
  }

  private async findJobById(id: string): Promise<IngestionJob | null> {
    return this.ingestionJobRepository.findOne({
      where: { id },
      relations: { sourceAsset: true },
    });
  }
}
