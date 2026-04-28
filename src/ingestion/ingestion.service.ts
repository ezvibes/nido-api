import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { IngestionJob } from './entities/ingestion-job.entity';
import { SourceAsset } from './entities/source-asset.entity';
import { IngestionJobResponse } from './interfaces/ingestion-job-response.interface';
import { IngestionUploadResult } from './interfaces/ingestion-upload-result.interface';
import { IngestionStorageService } from './storage/ingestion-storage.service';

type UploadableFile = Express.Multer.File;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly storageService: IngestionStorageService,
    @InjectRepository(SourceAsset)
    private readonly sourceAssetRepository: Repository<SourceAsset>,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
  ) {}

  async uploadImage(
    file: UploadableFile,
    dto: CreateIngestionUploadDto,
    uid: string,
  ): Promise<IngestionUploadResult> {
    const bucketName = this.storageService.getConfiguredBucketName();

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
    const objectName = this.buildObjectName(file.originalname, uid, uploadedAt);

    await this.storageService.uploadObject(
      bucketName,
      objectName,
      file.buffer,
      {
        uploadedByUid: uid,
        city: dto.city ?? '',
        source: dto.source ?? 'flyer_upload',
        originalFilename: file.originalname,
      },
      file.mimetype,
    );

    const sourceAsset = await this.sourceAssetRepository.save(
      this.sourceAssetRepository.create({
        storageUri: `gs://${bucketName}/${objectName}`,
        objectName,
        bucket: bucketName,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        city: dto.city,
        source: dto.source ?? 'flyer_upload',
        uploadedByUid: uid,
        size: file.size,
      }),
    );

    const ingestionJob = await this.ingestionJobRepository.save(
      this.ingestionJobRepository.create({
        sourceAssetId: sourceAsset.id,
        status: 'queued',
        stage: 'queued',
      }),
    );

    return {
      sourceAssetId: sourceAsset.id,
      ingestionJobId: ingestionJob.id,
      status: ingestionJob.status,
      bucket: bucketName,
      objectName,
      storageUri: `gs://${bucketName}/${objectName}`,
      contentType: file.mimetype,
      size: file.size,
      originalFilename: file.originalname,
      city: dto.city,
      source: dto.source ?? 'flyer_upload',
      uploadedAt,
    };
  }

  async createJob(
    dto: CreateIngestionJobDto,
    uid: string,
  ): Promise<IngestionJobResponse> {
    const sourceAsset = await this.sourceAssetRepository.findOne({
      where: {
        id: dto.sourceAssetId,
        uploadedByUid: uid,
      },
    });

    if (!sourceAsset) {
      throw new NotFoundException(
        `Source asset ${dto.sourceAssetId} not found`,
      );
    }

    const ingestionJob = await this.ingestionJobRepository.save(
      this.ingestionJobRepository.create({
        sourceAssetId: sourceAsset.id,
        sourceAsset,
        status: 'queued',
        stage: 'queued',
      }),
    );

    return this.toJobResponse({
      ...ingestionJob,
      sourceAsset,
    } as IngestionJob);
  }

  async getJob(id: string, uid: string): Promise<IngestionJobResponse> {
    const job = await this.ingestionJobRepository.findOne({
      where: { id, sourceAsset: { uploadedByUid: uid } },
      relations: { sourceAsset: true },
    });

    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    return this.toJobResponse(job);
  }

  private toJobResponse(job: IngestionJob): IngestionJobResponse {
    if (!job.sourceAsset) {
      this.logger.warn(`Ingestion job ${job.id} was loaded without sourceAsset`);
    }

    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      errorMessage: job.errorMessage,
      ocrText: job.ocrText,
      ocrProvider: job.ocrProvider,
      ocrConfidence: job.ocrConfidence,
      processingStartedAt: job.processingStartedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      sourceAsset: {
        id: job.sourceAsset.id,
        storageUri: job.sourceAsset.storageUri,
        objectName: job.sourceAsset.objectName,
        bucket: job.sourceAsset.bucket,
        mimeType: job.sourceAsset.mimeType,
        originalFilename: job.sourceAsset.originalFilename,
        city: job.sourceAsset.city,
        source: job.sourceAsset.source,
        size: Number(job.sourceAsset.size),
        uploadedByUid: job.sourceAsset.uploadedByUid,
        createdAt: job.sourceAsset.createdAt,
      },
    };
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
