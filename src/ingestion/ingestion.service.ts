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
import { SourceAsset } from './entities/source-asset.entity';
import { IngestionJobResponse } from './interfaces/ingestion-job-response.interface';
import { IngestionUploadResult } from './interfaces/ingestion-upload-result.interface';

type UploadableFile = Express.Multer.File;

@Injectable()
export class IngestionService {
  private readonly bucketName?: string;
  private readonly storage: Storage;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SourceAsset)
    private readonly sourceAssetRepository: Repository<SourceAsset>,
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
    const privateKey = (
      this.configService.get<string>('GCP_PRIVATE_KEY') ??
      this.configService.get<string>('FIREBASE_PRIVATE_KEY')
    )?.replace(/\\n/g, '\n');

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

  async uploadImage(
    file: UploadableFile,
    dto: CreateIngestionUploadDto,
    uid: string,
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
          source: dto.source ?? 'flyer_upload',
          originalFilename: file.originalname,
        },
      },
    });

    const sourceAsset = await this.sourceAssetRepository.save(
      this.sourceAssetRepository.create({
        storageUri: `gs://${this.bucketName}/${objectName}`,
        objectName,
        bucket: this.bucketName,
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
        stage: 'uploaded',
      }),
    );

    return {
      sourceAssetId: sourceAsset.id,
      ingestionJobId: ingestionJob.id,
      status: ingestionJob.status,
      bucket: this.bucketName,
      objectName,
      storageUri: `gs://${this.bucketName}/${objectName}`,
      contentType: file.mimetype,
      size: file.size,
      originalFilename: file.originalname,
      city: dto.city,
      source: dto.source ?? 'flyer_upload',
      uploadedAt,
    };
  }

  async getJob(id: string, uid: string): Promise<IngestionJobResponse> {
    const job = await this.ingestionJobRepository.findOne({
      where: { id, sourceAsset: { uploadedByUid: uid } },
      relations: { sourceAsset: true },
    });

    if (!job) {
      throw new NotFoundException(`Ingestion job ${id} not found`);
    }

    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      errorMessage: job.errorMessage,
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
