import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { SourceAsset } from './entities/source-asset.entity';
import { IngestionJob } from './entities/ingestion-job.entity';

describe('IngestionService', () => {
  let service: IngestionService;

  const sourceAssetRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const ingestionJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
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
          provide: getRepositoryToken(SourceAsset),
          useValue: sourceAssetRepository,
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
});
