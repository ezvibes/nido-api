import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { IngestionCandidate } from './entities/ingestion-candidate.entity';
import { IngestionService } from './ingestion.service';
import { SourceAsset } from './entities/source-asset.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { IngestionStorageService } from './storage/ingestion-storage.service';

describe('IngestionService', () => {
  let service: IngestionService;

  const sourceAssetRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const ingestionJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const ingestionCandidateRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const storageService = {
      getConfiguredBucketName: jest.fn().mockReturnValue('test-bucket'),
      uploadObject: jest.fn().mockResolvedValue(undefined),
    };

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
          provide: IngestionStorageService,
          useValue: storageService,
        },
        {
          provide: getRepositoryToken(SourceAsset),
          useValue: sourceAssetRepository,
        },
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: ingestionJobRepository,
        },
        {
          provide: getRepositoryToken(IngestionCandidate),
          useValue: ingestionCandidateRepository,
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
    } as Express.Multer.File;

    sourceAssetRepository.create.mockImplementation((value) => value);
    sourceAssetRepository.save.mockResolvedValue({
      id: 'asset-1',
      ...sourceAssetRepository.create.mock.calls[0]?.[0],
    });

    ingestionJobRepository.create.mockImplementation((value) => value);
    ingestionJobRepository.save.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      stage: 'uploaded',
    });

    const result = await service.uploadImage(
      file,
      { city: 'wilmington', source: 'flyer_upload' },
      'uid-1',
    );

    expect(sourceAssetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'wilmington',
        source: 'flyer_upload',
        uploadedByUid: 'uid-1',
      }),
    );
    expect(result.sourceAssetId).toBe('asset-1');
    expect(result.ingestionJobId).toBe('job-1');
    expect(result.city).toBe('wilmington');
    expect(result.source).toBe('flyer_upload');
  });

  it('should create a queued OCR job for an owned source asset', async () => {
    sourceAssetRepository.findOne.mockResolvedValue({
      id: 'asset-1',
      uploadedByUid: 'uid-1',
    });
    ingestionJobRepository.create.mockImplementation((value) => value);
    ingestionJobRepository.save.mockResolvedValue({
      id: 'job-2',
      sourceAssetId: 'asset-1',
      status: 'queued',
      stage: 'queued',
      sourceAsset: {
        id: 'asset-1',
        storageUri: 'gs://bucket/path.jpg',
        objectName: 'path.jpg',
        bucket: 'bucket',
        mimeType: 'image/jpeg',
        originalFilename: 'poster.jpg',
        source: 'flyer_upload',
        size: 123,
        uploadedByUid: 'uid-1',
        createdAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createJob({ sourceAssetId: 'asset-1' }, 'uid-1');

    expect(ingestionJobRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAssetId: 'asset-1',
        status: 'queued',
        stage: 'queued',
      }),
    );
    expect(result.id).toBe('job-2');
  });

  it('should reject job creation for an asset the user does not own', async () => {
    sourceAssetRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createJob({ sourceAssetId: 'missing-asset' }, 'uid-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should return a candidate detail scoped to the owning user', async () => {
    const candidate = {
      id: 'candidate-1',
      ingestionJobId: 'job-1',
      sourceAssetId: 'asset-1',
      status: 'needs_review',
      title: 'THE HEADLINERS + DJ MOON',
      artistNames: ['THE HEADLINERS', 'DJ MOON'],
      rawOcrText: 'flyer text',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    ingestionCandidateRepository.findOne.mockResolvedValue(candidate);

    const result = await service.getCandidate('candidate-1', 'uid-1');

    expect(ingestionCandidateRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'candidate-1',
          sourceAsset: { uploadedByUid: 'uid-1' },
        },
      }),
    );
    expect(result.id).toBe('candidate-1');
    expect(result.status).toBe('needs_review');
  });
});
