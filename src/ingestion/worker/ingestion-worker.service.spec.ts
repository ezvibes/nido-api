import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { SourceAsset } from '../entities/source-asset.entity';
import { VisionOcrService } from '../ocr/vision-ocr.service';
import { IngestionParserService } from '../parser/ingestion-parser.service';
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
  const candidates: IngestionCandidate[] = [];

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

  const ingestionParserService = {
    parseOcrText: jest.fn(),
  };

  const ingestionCandidateRepository = {
    create: jest.fn((value: IngestionCandidate) => value),
    delete: jest.fn(async (criteria: { ingestionJobId: string }) => {
      const remaining = candidates.filter(
        (candidate) => candidate.ingestionJobId !== criteria.ingestionJobId,
      );
      candidates.length = 0;
      candidates.push(...remaining);
      return { affected: 1 };
    }),
    save: jest.fn(async (value: IngestionCandidate[]) => {
      candidates.push(...value);
      return value.map((candidate, index) => ({
        ...candidate,
        id: candidate.id ?? `candidate-${index + 1}`,
      }));
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jobs.clear();
    candidates.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionWorkerService,
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: ingestionJobRepository,
        },
        {
          provide: getRepositoryToken(IngestionCandidate),
          useValue: ingestionCandidateRepository,
        },
        {
          provide: IngestionStorageService,
          useValue: ingestionStorageService,
        },
        {
          provide: VisionOcrService,
          useValue: visionOcrService,
        },
        {
          provide: IngestionParserService,
          useValue: ingestionParserService,
        },
      ],
    }).compile();

    service = module.get<IngestionWorkerService>(IngestionWorkerService);
  });

  it('should claim a queued job and transition it to needs_review after OCR and parsing succeed', async () => {
    jobs.set('job-1', {
      id: 'job-1',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'queued',
      stage: 'queued',
      errorMessage: 'old error',
      failedAt: new Date('2026-03-31T23:00:00Z'),
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    ingestionStorageService.objectExists.mockResolvedValue(true);
    visionOcrService.extractText.mockResolvedValue({
      provider: 'google-vision',
      text: 'Local band at Cat\'s Cradle',
      confidence: 0.91,
    });
    ingestionParserService.parseOcrText.mockReturnValue([
      {
        status: 'needs_review',
        title: 'Local band at Cat\'s Cradle',
        artistNames: ['Local band'],
        parserVersion: 'mvp-v1',
        parseConfidence: 0.91,
        parseWarnings: [],
        rawExtractedFields: { cityLine: 'Carrboro, NC' },
        rawOcrText: 'Local band at Cat\'s Cradle',
      },
    ]);

    const result = await service.processNextQueuedJob();

    expect(result).toEqual({
      jobId: 'job-1',
      status: 'needs_review',
      stage: 'parsed',
    });
    expect(jobs.get('job-1')).toEqual(
      expect.objectContaining({
        status: 'needs_review',
        stage: 'parsed',
        ocrProvider: 'google-vision',
        ocrText: 'Local band at Cat\'s Cradle',
        ocrConfidence: 0.91,
        errorMessage: undefined,
        failedAt: undefined,
      }),
    );
    expect(candidates).toHaveLength(1);
    expect(ingestionCandidateRepository.delete).toHaveBeenCalledWith({
      ingestionJobId: 'job-1',
    });
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
      ocrProvider: 'google-vision',
      ocrText: 'stale text',
      ocrConfidence: 0.77,
      completedAt: new Date('2026-04-01T01:00:00Z'),
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    ingestionStorageService.objectExists.mockResolvedValue(true);
    visionOcrService.extractText.mockRejectedValue(
      new Error('Vision quota exceeded'),
    );
    ingestionParserService.parseOcrText.mockReturnValue([]);

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
        ocrProvider: undefined,
        ocrText: undefined,
        ocrConfidence: undefined,
        completedAt: undefined,
      }),
    );
  });

  it('should not reprocess a job that is already in processing state', async () => {
    jobs.set('job-4', {
      id: 'job-4',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'processing',
      stage: 'ocr',
      createdAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    } as IngestionJob);

    const result = await service.processJobById('job-4');

    expect(result).toEqual({
      jobId: 'job-4',
      status: 'processing',
      stage: 'ocr',
      errorMessage: undefined,
    });
    expect(visionOcrService.extractText).not.toHaveBeenCalled();
    expect(ingestionStorageService.objectExists).not.toHaveBeenCalled();
  });

  it('should replace existing candidates when a job is reprocessed', async () => {
    candidates.push({
      id: 'candidate-old',
      ingestionJobId: 'job-5',
      sourceAssetId: sourceAsset.id,
      sourceAsset,
      status: 'needs_review',
      title: 'old candidate',
      rawOcrText: 'old',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IngestionCandidate);

    jobs.set('job-5', {
      id: 'job-5',
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
      text: 'new flyer text',
      confidence: 0.88,
    });
    ingestionParserService.parseOcrText.mockReturnValue([
      {
        status: 'needs_review',
        title: 'new candidate',
        parserVersion: 'mvp-v1',
        parseConfidence: 0.88,
        parseWarnings: [],
        rawExtractedFields: {},
        rawOcrText: 'new flyer text',
      },
    ]);

    await service.processNextQueuedJob();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe('new candidate');
  });
});
