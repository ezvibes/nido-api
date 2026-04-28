import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ConcertUpload } from './entities/concert-upload.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { UploadableFile } from './interfaces/uploadable-file.interface';

describe('IngestionService', () => {
  let service: IngestionService;

  const concertUploadRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const ingestionJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GCS_INGESTION_BUCKET') return 'test-bucket';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(ConcertUpload),
          useValue: concertUploadRepository,
        },
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: ingestionJobRepository,
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should persist the upload metadata with the simplified dto shape', async () => {
    const file = {
      originalname: 'poster.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('image'),
      size: 5,
    } as UploadableFile;

    concertUploadRepository.create.mockImplementation((value) => value);
    concertUploadRepository.save.mockResolvedValue({
      id: 'asset-1',
      ...concertUploadRepository.create.mock.calls[0]?.[0],
    });

    const bucketMock = {
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue(undefined),
      }),
    };

    Object.defineProperty(service as object, 'storage', {
      value: { bucket: jest.fn().mockReturnValue(bucketMock) },
    });

    const result = await service.uploadImage(
      file,
      { city: 'wilmington', state: 'NC', source: 'flyer_upload' },
      'uid-1',
      3,
    );

    expect(concertUploadRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'wilmington',
        state: 'NC',
        source: 'flyer_upload',
        uploadedByUid: 'uid-1',
        uploadedByUserId: 3,
      }),
    );
    expect(result.concertUploadId).toBe('asset-1');
    expect(result.city).toBe('wilmington');
    expect(result.state).toBe('NC');
    expect(result.source).toBe('flyer_upload');
    expect(result.uploadedByUserId).toBe(3);
  });

  it('should create a queued job for an owned concert upload', async () => {
    const concertUpload = {
      id: 'asset-1',
      storageUri: 'gs://bucket/path/file.jpg',
      objectName: 'path/file.jpg',
      bucket: 'test-bucket',
      mimeType: 'image/jpeg',
      originalFilename: 'poster.jpg',
      city: 'wilmington',
      state: 'NC',
      source: 'flyer_upload',
      size: 12,
      uploadedByUid: 'uid-1',
      uploadedByUserId: 3,
      createdAt: new Date(),
    };
    concertUploadRepository.findOne.mockResolvedValue(concertUpload);
    ingestionJobRepository.create.mockImplementation((value) => value);
    ingestionJobRepository.save.mockResolvedValue({
      id: 'job-1',
      concertUploadId: 'asset-1',
      status: 'queued',
      stage: 'enqueued',
      ocrProvider: 'google_vision',
      parserVersion: 'phase1-skeleton',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest.spyOn(service as any, 'runJobSkeleton').mockResolvedValue(undefined);

    const result = await service.createJob('asset-1', 'uid-1');

    expect(concertUploadRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'asset-1', uploadedByUid: 'uid-1' },
    });
    expect(ingestionJobRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        concertUploadId: 'asset-1',
        status: 'queued',
        stage: 'enqueued',
        ocrProvider: 'google_vision',
        parserVersion: 'phase1-skeleton',
      }),
    );
    expect(result.id).toBe('job-1');
    expect(result.concertUpload.id).toBe('asset-1');
    expect(result.concertUpload.uploadedByUserId).toBe(3);
  });

  it('should return an owned concert upload by id', async () => {
    const createdAt = new Date();
    concertUploadRepository.findOne.mockResolvedValue({
      id: 'asset-1',
      storageUri: 'gs://bucket/path/file.jpg',
      objectName: 'path/file.jpg',
      bucket: 'test-bucket',
      mimeType: 'image/jpeg',
      originalFilename: 'poster.jpg',
      city: 'wilmington',
      state: 'NC',
      source: 'flyer_upload',
      size: 12,
      uploadedByUid: 'uid-1',
      uploadedByUserId: 3,
      createdAt,
    });

    const result = await service.getConcertUpload('asset-1', 'uid-1');

    expect(concertUploadRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'asset-1', uploadedByUid: 'uid-1' },
    });
    expect(result.concertUploadId).toBe('asset-1');
    expect(result.uploadedAt).toBe(createdAt.toISOString());
  });

  it('should reject upload when the bucket is not configured', async () => {
    const missingBucketModule: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
        {
          provide: getRepositoryToken(ConcertUpload),
          useValue: concertUploadRepository,
        },
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: ingestionJobRepository,
        },
      ],
    }).compile();

    const missingBucketService = missingBucketModule.get<IngestionService>(IngestionService);

    await expect(
      missingBucketService.uploadImage(
        {
          originalname: 'poster.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('image'),
          size: 5,
        } as UploadableFile,
        {},
        'uid-1',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should reject non-image uploads', async () => {
    await expect(
      service.uploadImage(
        {
          originalname: 'flyer.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('pdf'),
          size: 3,
        } as UploadableFile,
        {},
        'uid-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject unknown jobs for the current user', async () => {
    ingestionJobRepository.findOne.mockResolvedValue(null);

    await expect(service.getJob('job-404', 'uid-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should reject unknown concert uploads when creating a job', async () => {
    concertUploadRepository.findOne.mockResolvedValue(null);

    await expect(service.createJob('asset-404', 'uid-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
