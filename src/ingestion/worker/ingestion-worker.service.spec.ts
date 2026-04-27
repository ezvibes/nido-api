import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { SourceAsset } from '../entities/source-asset.entity';
import { VisionOcrService } from '../ocr/vision-ocr.service';
import { IngestionStorageService } from '../storage/ingestion-storage.service';
import { IngestionWorkerService } from './ingestion-worker.service';

describe('IngestionWorkerService', () => {
  let service: IngestionWorkerService;

  const sourceAsset: SourceAsset = {
    id: 'asset-1',
    storageUri: 'gs://test-bucket/ingestion/uploads/flyer.jpg',
    objectName: 'ingestion/uploads/flyer.jpg',
    bucket: 'test-bucket',
    mimeType: 'image/jpeg',
    originalFilename: 'flyer.jpg',
    source: 'flyer_upload',
    uploadedByUid: 'uid-1',
    size: 42,
    createdAt: new Date(),
    ingestionJobs: [],
  };

  const jobs = new Map<string, IngestionJob>();

  const ingestionJobRepository = {
    findOne: jest.fn(async (options: any) => {
      if (options?.where?.id) {
        return jobs.get(options.where.id) ?? null;
      }

      if (options?.where?.status === 'queued') {
        return (
          [...jobs.values()]
            .filter((job) => job.status === 'queued')
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ??
          null
        );
      }

      return null;
    }),
    update: jest.fn(async (criteria: any, patch: Partial<IngestionJob>) => {
      const id = typeof criteria === 'string' ? criteria : criteria.id;
      const expectedStatus = typeof criteria === 'string' ? undefined : criteria.status;
      const job = jobs.get(id);

      if (!job) {
        return { affected: 0 };
      }

      if (expectedStatus && job.status !== expectedStatus) {
        return { affected: 0 };
      }

      Object.assign(job, patch, { updatedAt: new Date() });
      jobs.set(id, job);

      return { affected: 1 };
    }),
  };

  const ingestionStorageService = {
    objectExists: jest.fn(),
  };

  const visionOcrService = {
    extractText: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jobs.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionWorkerService,
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: ingestionJobRepository,
        },
        {
          provide: IngestionStorageService,
          useValue: ingestionStorageService,
        },
        {
          provide: VisionOcrService,
          useValue: visionOcrService,
        },
      ],
    }).compile();

    service = module.get<IngestionWorkerService>(IngestionWorkerService);
  });

  it('should claim a queued job and transition it to parsed after OCR succeeds', async () => {
    jobs.set('job-1', {
      id: 'job-1',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'queued',
      stage: 'queued',
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    ingestionStorageService.objectExists.mockResolvedValue(true);
    visionOcrService.extractText.mockResolvedValue({
      provider: 'google-vision',
      text: 'Local band at Cat\'s Cradle',
      confidence: 0.91,
    });

    const result = await service.processNextQueuedJob();

    expect(result).toEqual({
      jobId: 'job-1',
      status: 'parsed',
      stage: 'parsed',
    });
    expect(jobs.get('job-1')).toEqual(
      expect.objectContaining({
        status: 'parsed',
        stage: 'parsed',
        ocrProvider: 'google-vision',
        ocrText: 'Local band at Cat\'s Cradle',
        ocrConfidence: 0.91,
      }),
    );
  });

  it('should mark a job failed when the source object is missing from GCS', async () => {
    jobs.set('job-2', {
      id: 'job-2',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'queued',
      stage: 'queued',
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    ingestionStorageService.objectExists.mockResolvedValue(false);

    const result = await service.processNextQueuedJob();

    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job-2',
        status: 'failed',
      }),
    );
    expect(jobs.get('job-2')).toEqual(
      expect.objectContaining({
        status: 'failed',
        stage: 'failed',
        errorMessage: expect.stringContaining('was not found'),
      }),
    );
  });

  it('should mark a job failed when Vision OCR throws', async () => {
    jobs.set('job-3', {
      id: 'job-3',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'queued',
      stage: 'queued',
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    ingestionStorageService.objectExists.mockResolvedValue(true);
    visionOcrService.extractText.mockRejectedValue(
      new Error('Vision quota exceeded'),
    );

    const result = await service.processNextQueuedJob();

    expect(result).toEqual({
      jobId: 'job-3',
      status: 'failed',
      stage: 'failed',
      errorMessage: 'Vision quota exceeded',
    });
    expect(jobs.get('job-3')).toEqual(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Vision quota exceeded',
      }),
    );
  });
});
