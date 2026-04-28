import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { IngestionJob } from './entities/ingestion-job.entity';
import { ConcertUpload } from './entities/concert-upload.entity';
import { IngestionJobResponse } from './interfaces/ingestion-job-response.interface';
import { IngestionUploadResult } from './interfaces/ingestion-upload-result.interface';
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
    this.bucketName = this.configService.get<string>('GCS_INGESTION_BUCKET');

    const projectId =
      this.configService.get<string>('GCP_PROJECT_ID') ??
      this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail =
      this.configService.get<string>('GCP_CLIENT_EMAIL') ??
      this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.resolvePrivateKey();

    this.storage =
      projectId && clientEmail && privateKey
        ? new Storage({
            projectId,
            credentials: {
              client_email: clientEmail,
              private_key: privateKey,
            },
          })
        : new Storage();
  }

  private resolvePrivateKey() {
    const directPrivateKey =
      this.configService.get<string>('GCP_PRIVATE_KEY') ??
      this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (directPrivateKey) {
      return directPrivateKey.replace(/\\n/g, '\n');
    }

    const legacyFirebasePrivateKey =
      this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID');
    if (legacyFirebasePrivateKey?.includes('BEGIN PRIVATE KEY')) {
      return legacyFirebasePrivateKey.replace(/\\n/g, '\n');
    }

    return undefined;
  }

  async uploadImage(
    file: UploadableFile,
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

  async createJob(concertUploadId: string | undefined, uid: string): Promise<IngestionJobResponse> {
    if (!concertUploadId) {
      throw new NotFoundException('Concert upload not found');
    }

    const concertUpload = await this.concertUploadRepository.findOne({
      where: { id: concertUploadId, uploadedByUid: uid },
    });

    if (!concertUpload) {
      throw new NotFoundException(`Concert upload ${concertUploadId} not found`);
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

    return this.mapJobResponse({ ...ingestionJob, concertUpload } as IngestionJob);
  }

  async getConcertUpload(id: string, uid: string): Promise<IngestionUploadResult> {
    const concertUpload = await this.concertUploadRepository.findOne({
      where: { id, uploadedByUid: uid },
    });

    if (!concertUpload) {
      throw new NotFoundException(`Concert upload ${id} not found`);
    }

    return this.mapConcertUploadResponse(concertUpload);
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

  private mapConcertUploadResponse(concertUpload: ConcertUpload): IngestionUploadResult {
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
        error instanceof Error ? error.message : 'Unknown ingestion worker error';
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
