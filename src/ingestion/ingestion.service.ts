import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { ReviewConcertUploadDto } from './dto/review-concert-upload.dto';
import { IngestionJob } from './entities/ingestion-job.entity';
import { ConcertUpload } from './entities/concert-upload.entity';
import { IngestionJobResponse } from './interfaces/ingestion-job-response.interface';
import { IngestionUploadResult } from './interfaces/ingestion-upload-result.interface';
import type {
  AdminConcertUploadListItem,
  AdminConcertUploadListResponse,
} from './interfaces/admin-concert-upload.interface';
import { UploadableFile } from './interfaces/uploadable-file.interface';

@Injectable()
export class IngestionService {
  private readonly defaultOcrProvider = 'google_vision';
  private readonly parserVersion = 'phase1-skeleton';
  private readonly bucketName?: string;
  private readonly storage: Storage;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ConcertUpload)
    private readonly concertUploadRepository: Repository<ConcertUpload>,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
  ) {
    this.bucketName =
      this.configService.get<string>('GCS_INGESTION_BUCKET')?.trim() ||
      undefined;

    const serviceAccountFromEnv = this.resolveServiceAccountFromEnv();
    const serviceAccountFromPath = this.resolveServiceAccountFromPath();

    const serviceAccount = serviceAccountFromEnv ?? serviceAccountFromPath;

    const projectId =
      serviceAccount?.project_id ??
      this.configService.get<string>('GCP_PROJECT_ID') ??
      this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail =
      serviceAccount?.client_email ??
      this.configService.get<string>('GCP_CLIENT_EMAIL') ??
      this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = serviceAccount?.private_key ?? this.resolvePrivateKey();

    this.storage =
      projectId && clientEmail && privateKey
        ? new Storage({
            projectId,
            credentials: {
              client_email: clientEmail,
              private_key: privateKey.replace(/\\n/g, '\n'),
            },
          })
        : new Storage();
  }

  private resolveServiceAccountFromEnv():
    | { project_id?: string; client_email?: string; private_key?: string }
    | undefined {
    const raw = this.configService.get<string>('GCP_SERVICE_ACCOUNT_JSON');
    if (!raw?.trim()) return undefined;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        project_id:
          typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
        client_email:
          typeof parsed.client_email === 'string'
            ? parsed.client_email
            : undefined,
        private_key:
          typeof parsed.private_key === 'string'
            ? parsed.private_key
            : undefined,
      };
    } catch {
      throw new InternalServerErrorException(
        'GCP_SERVICE_ACCOUNT_JSON is set but is not valid JSON.',
      );
    }
  }

  private resolveServiceAccountFromPath():
    | { project_id?: string; client_email?: string; private_key?: string }
    | undefined {
    const path = this.configService.get<string>('GCP_SERVICE_ACCOUNT_PATH');
    if (!path?.trim()) return undefined;

    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        project_id:
          typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
        client_email:
          typeof parsed.client_email === 'string'
            ? parsed.client_email
            : undefined,
        private_key:
          typeof parsed.private_key === 'string'
            ? parsed.private_key
            : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Failed to load GCP service account from GCP_SERVICE_ACCOUNT_PATH (${path}): ${errorMessage}`,
      );
    }
  }

  private resolvePrivateKey() {
    const directPrivateKey =
      this.configService.get<string>('GCP_PRIVATE_KEY') ??
      this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (directPrivateKey) {
      return directPrivateKey.replace(/\\n/g, '\n');
    }

    const legacyFirebasePrivateKey = this.configService.get<string>(
      'FIREBASE_PRIVATE_KEY_ID',
    );
    if (legacyFirebasePrivateKey?.includes('BEGIN PRIVATE KEY')) {
      return legacyFirebasePrivateKey.replace(/\\n/g, '\n');
    }

    return undefined;
  }

  private getTerminalReviewStage(
    status: ReviewConcertUploadDto['status'],
  ): string | undefined {
    switch (status) {
      case 'approved':
        return 'admin_approved';
      case 'rejected':
        return 'admin_rejected';
      case 'past':
        return 'admin_marked_past';
      case 'submitted':
      default:
        return undefined;
    }
  }

  private normalizeReviewStatus(
    status: string | undefined | null,
  ): 'submitted' | 'approved' | 'rejected' | 'past' {
    switch (status) {
      case 'approved':
      case 'rejected':
      case 'past':
      case 'submitted':
        return status;
      case 'pending':
      case 'needs_review':
      default:
        return 'submitted';
    }
  }

  async uploadImage(
    file: UploadableFile | undefined,
    dto: CreateIngestionUploadDto,
    uid: string,
    uploadedByUserId?: number,
  ): Promise<IngestionUploadResult> {
    if (!this.bucketName) {
      throw new InternalServerErrorException(
        'GCS_INGESTION_BUCKET is not configured.',
      );
    }

    if (!file) {
      throw new BadRequestException('An image file is required.');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported.');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded image payload is empty.');
    }

    const uploadedAt = new Date().toISOString();
    const normalizedSource = dto.source ?? 'flyer_upload';
    const objectName = this.buildObjectName(file.originalname, uid, uploadedAt);
    const bucket = this.storage.bucket(this.bucketName);
    const object = bucket.file(objectName);

    console.log(`[DEBUG] Attempting to upload to bucket: "${this.bucketName}"`);

    try {
      await object.save(file.buffer, {
        resumable: false,
        contentType: file.mimetype,
        metadata: {
          metadata: {
            uploadedByUid: uid,
            city: dto.city ?? '',
            state: dto.state ?? '',
            source: normalizedSource,
            uploadedByUserId: uploadedByUserId?.toString() ?? '',
            originalFilename: file.originalname,
          },
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown GCS upload error';
      throw new InternalServerErrorException(
        `Failed to upload image to GCS. Verify GCS_INGESTION_BUCKET exists and the configured credentials have storage.objects.create permission. ${errorMessage}`,
      );
    }

    const concertUpload = await this.concertUploadRepository.save(
      this.concertUploadRepository.create({
        storageUri: `gs://${this.bucketName}/${objectName}`,
        objectName,
        bucket: this.bucketName,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        city: dto.city,
        state: dto.state,
        source: normalizedSource,
        reviewStatus: 'submitted',
        uploadedByUid: uid,
        uploadedByUserId,
        size: file.size,
      }),
    );

    return {
      concertUploadId: concertUpload.id,
      bucket: this.bucketName,
      objectName,
      storageUri: `gs://${this.bucketName}/${objectName}`,
      contentType: file.mimetype,
      size: file.size,
      originalFilename: file.originalname,
      city: dto.city,
      state: dto.state,
      source: normalizedSource,
      uploadedByUserId,
      uploadedAt,
    };
  }

  async createJob(
    concertUploadId: string | undefined,
    uid: string,
  ): Promise<IngestionJobResponse> {
    if (!concertUploadId) {
      throw new NotFoundException('Concert upload not found');
    }

    const concertUpload = await this.concertUploadRepository.findOne({
      where: { id: concertUploadId, uploadedByUid: uid },
    });

    if (!concertUpload) {
      throw new NotFoundException(
        `Concert upload ${concertUploadId} not found`,
      );
    }

    const ingestionJob = await this.ingestionJobRepository.save(
      this.ingestionJobRepository.create({
        concertUploadId: concertUpload.id,
        status: 'queued',
        stage: 'enqueued',
        ocrProvider: this.defaultOcrProvider,
        parserVersion: this.parserVersion,
      }),
    );

    void this.runJobSkeleton(ingestionJob.id);

    return this.mapJobResponse({
      ...ingestionJob,
      concertUpload,
    } as IngestionJob);
  }

  async getConcertUpload(
    id: string,
    uid: string,
  ): Promise<IngestionUploadResult> {
    const concertUpload = await this.concertUploadRepository.findOne({
      where: { id, uploadedByUid: uid },
    });

    if (!concertUpload) {
      throw new NotFoundException(`Concert upload ${id} not found`);
    }

    return this.mapConcertUploadResponse(concertUpload);
  }

  async adminListConcertUploads(options?: {
    limit?: number;
    offset?: number;
    reviewStatus?: string;
  }): Promise<AdminConcertUploadListResponse> {
    const requestedLimit = Number.isFinite(options?.limit)
      ? options?.limit
      : undefined;
    const requestedOffset = Number.isFinite(options?.offset)
      ? options?.offset
      : undefined;

    const limit = Math.min(Math.max(requestedLimit ?? 25, 1), 100);
    const offset = Math.max(requestedOffset ?? 0, 0);
    const reviewStatus = options?.reviewStatus?.trim() || undefined;

    const qb = this.concertUploadRepository
      .createQueryBuilder('upload')
      .leftJoinAndSelect('upload.uploadedByUser', 'uploadedByUser')
      .leftJoinAndSelect('upload.reviewedByUser', 'reviewedByUser')
      .orderBy('upload.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (reviewStatus) {
      if (reviewStatus === 'submitted') {
        qb.andWhere('upload.reviewStatus IN (:...reviewStatuses)', {
          reviewStatuses: ['submitted', 'pending', 'needs_review'],
        });
      } else {
        qb.andWhere('upload.reviewStatus = :reviewStatus', { reviewStatus });
      }
    }

    const [uploads, total] = await qb.getManyAndCount();

    const items: AdminConcertUploadListItem[] = uploads.map((upload) => ({
      id: upload.id,
      storageUri: upload.storageUri,
      bucket: upload.bucket,
      objectName: upload.objectName,
      mimeType: upload.mimeType,
      originalFilename: upload.originalFilename,
      size: Number(upload.size),
      city: upload.city,
      state: upload.state,
      source: upload.source,
      uploadedByUid: upload.uploadedByUid,
      uploadedByUserId: upload.uploadedByUserId,
      uploadedByUserEmail: upload.uploadedByUser?.email,
      createdAt: upload.createdAt.toISOString(),
      reviewStatus: this.normalizeReviewStatus(upload.reviewStatus),
      reviewNotes: upload.reviewNotes,
      reviewedAt: upload.reviewedAt?.toISOString(),
      reviewedByUserId: upload.reviewedByUserId,
      reviewedByUserEmail: upload.reviewedByUser?.email,
    }));

    return { total, items };
  }

  async adminReviewConcertUpload(
    uploadId: string,
    dto: ReviewConcertUploadDto,
    reviewedByUserId: number,
  ): Promise<AdminConcertUploadListItem> {
    const upload = await this.concertUploadRepository.findOne({
      where: { id: uploadId },
      relations: {
        uploadedByUser: true,
        reviewedByUser: true,
      },
    });

    if (!upload) {
      throw new NotFoundException(`Concert upload ${uploadId} not found`);
    }

    upload.reviewStatus = dto.status;
    upload.reviewNotes = dto.notes?.trim() || undefined;
    upload.reviewedAt = new Date();
    upload.reviewedByUserId = reviewedByUserId;

    const saved = await this.concertUploadRepository.save(upload);
    const terminalReviewStage = this.getTerminalReviewStage(dto.status);
    if (terminalReviewStage) {
      await this.ingestionJobRepository.update(
        { concertUploadId: saved.id, status: 'needs_review' },
        {
          status: 'completed',
          stage: terminalReviewStage,
        },
      );
    }

    const hydrated = await this.concertUploadRepository.findOneOrFail({
      where: { id: saved.id },
      relations: {
        uploadedByUser: true,
        reviewedByUser: true,
      },
    });

    return {
      id: hydrated.id,
      storageUri: hydrated.storageUri,
      bucket: hydrated.bucket,
      objectName: hydrated.objectName,
      mimeType: hydrated.mimeType,
      originalFilename: hydrated.originalFilename,
      size: Number(hydrated.size),
      city: hydrated.city,
      state: hydrated.state,
      source: hydrated.source,
      uploadedByUid: hydrated.uploadedByUid,
      uploadedByUserId: hydrated.uploadedByUserId,
      uploadedByUserEmail: hydrated.uploadedByUser?.email,
      createdAt: hydrated.createdAt.toISOString(),
      reviewStatus: this.normalizeReviewStatus(hydrated.reviewStatus),
      reviewNotes: hydrated.reviewNotes ?? undefined,
      reviewedAt: hydrated.reviewedAt?.toISOString(),
      reviewedByUserId: hydrated.reviewedByUserId,
      reviewedByUserEmail: hydrated.reviewedByUser?.email,
    };
  }

  async adminStreamUploadImage(uploadId: string, res: Response): Promise<void> {
    const upload = await this.concertUploadRepository.findOne({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new NotFoundException(`Concert upload ${uploadId} not found`);
    }

    try {
      res.setHeader('Content-Type', upload.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(upload.originalFilename)}"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=60');

      const bucket = this.storage.bucket(upload.bucket);
      const file = bucket.file(upload.objectName);
      await new Promise<void>((resolve, reject) => {
        const stream = file.createReadStream();
        stream.on('error', reject);
        res.on('error', reject);
        res.on('finish', resolve);
        stream.pipe(res);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown GCS read error';
      throw new InternalServerErrorException(
        `Failed to read image from GCS. ${errorMessage}`,
      );
    }
  }

  async getJob(id: string, uid: string): Promise<IngestionJobResponse> {
    const job = await this.ingestionJobRepository.findOne({
      where: { id, concertUpload: { uploadedByUid: uid } },
      relations: { concertUpload: true },
    });

    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    return this.mapJobResponse(job);
  }

  private mapJobResponse(job: IngestionJob): IngestionJobResponse {
    const concertUpload = job.concertUpload;

    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      ocrProvider: job.ocrProvider,
      ocrConfidence: job.ocrConfidence ?? null,
      parserVersion: job.parserVersion,
      parseConfidence: job.parseConfidence ?? null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      concertUpload: {
        id: concertUpload.id,
        storageUri: concertUpload.storageUri,
        objectName: concertUpload.objectName,
        bucket: concertUpload.bucket,
        mimeType: concertUpload.mimeType,
        originalFilename: concertUpload.originalFilename,
        city: concertUpload.city,
        state: concertUpload.state,
        source: concertUpload.source,
        size: Number(concertUpload.size),
        uploadedByUid: concertUpload.uploadedByUid,
        uploadedByUserId: concertUpload.uploadedByUserId,
        createdAt: concertUpload.createdAt,
      },
    };
  }

  private mapConcertUploadResponse(
    concertUpload: ConcertUpload,
  ): IngestionUploadResult {
    return {
      concertUploadId: concertUpload.id,
      bucket: concertUpload.bucket,
      objectName: concertUpload.objectName,
      storageUri: concertUpload.storageUri,
      contentType: concertUpload.mimeType,
      size: Number(concertUpload.size),
      originalFilename: concertUpload.originalFilename,
      city: concertUpload.city,
      state: concertUpload.state,
      source: concertUpload.source,
      uploadedByUserId: concertUpload.uploadedByUserId,
      uploadedAt: concertUpload.createdAt.toISOString(),
    };
  }

  private async runJobSkeleton(jobId: string) {
    try {
      await this.delay(25);
      await this.ingestionJobRepository.update(jobId, {
        status: 'processing',
        stage: 'ocr_started',
      });

      await this.delay(75);
      await this.ingestionJobRepository.update(jobId, {
        status: 'needs_review',
        stage: 'candidate_pending',
        ocrText: 'Phase 1 skeleton: OCR pending integration.',
        ocrConfidence: 0,
        parseConfidence: 0,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown ingestion worker error';
      await this.ingestionJobRepository.update(jobId, {
        status: 'failed',
        stage: 'worker_failed',
        errorMessage,
      });
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildObjectName(
    originalName: string,
    uid: string,
    uploadedAt: string,
  ): string {
    const datePrefix = uploadedAt.slice(0, 10);
    const safeBaseName = this.sanitizeFilename(originalName);
    return `ingestion/uploads/${datePrefix}/${uid}/${randomUUID()}-${safeBaseName}`;
  }

  private sanitizeFilename(filename: string): string {
    const extension = extname(filename).toLowerCase();
    const name = filename.slice(0, filename.length - extension.length);
    const safeName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    const normalizedExtension = extension.replace(/[^a-z0-9.]/g, '');
    return `${safeName || 'upload'}${normalizedExtension || ''}`;
  }
}
