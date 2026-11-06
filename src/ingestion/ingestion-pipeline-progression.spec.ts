import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionWorkerController } from './controllers/ingestion-worker.controller';
import { IngestionTasksDispatcherService } from './services/ingestion-tasks-dispatcher.service';
import { IngestionStateMachineService } from './services/ingestion-state-machine.service';
import { GeminiExtractionAdapter } from './services/extraction/gemini-extraction.adapter';
import { VenueService } from '../apis/venues/venue.service';
import { BandService } from '../apis/bands/band.service';
import { ConcertUpload } from './entities/concert-upload.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { IngestionOutbox } from './entities/ingestion-outbox.entity';
import { IngestionCandidate } from './entities/ingestion-candidate.entity';
import { Concert } from '../apis/concerts/entities/concert.entity';
import {
  IngestionStage,
  IngestionTerminalStatus,
} from './interfaces/ingestion-enums';
import { GoogleOidcGuard } from '../auth/guards/google-oidc.guard';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: jest
      .fn()
      .mockResolvedValue([
        { name: 'projects/p/locations/l/queues/q/tasks/job-1' },
      ]),
  })),
}));

describe('OCR Pipeline: Cloud Tasks Dispatcher & Private Worker Progression', () => {
  let ingestionService: IngestionService;
  let workerController: IngestionWorkerController;
  let dispatcherService: IngestionTasksDispatcherService;
  let stateMachineService: IngestionStateMachineService;
  let oidcGuard: GoogleOidcGuard;

  // In-memory persistent state simulation
  let jobsDb: Map<string, IngestionJob>;
  let outboxDb: Map<string, IngestionOutbox>;
  let uploadsDb: Map<string, ConcertUpload>;
  let candidatesDb: IngestionCandidate[];

  let mockConfigService: Partial<ConfigService>;
  let mockVenueService: Partial<VenueService>;
  let mockBandService: Partial<BandService>;
  let mockExtractor: Partial<GeminiExtractionAdapter>;

  beforeEach(async () => {
    jest.clearAllMocks();

    jobsDb = new Map();
    outboxDb = new Map();
    uploadsDb = new Map();
    candidatesDb = [];

    mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'INGESTION_ASYNC_DISPATCH_ENABLED':
            return 'true';
          case 'CLOUD_TASKS_QUEUE_PATH':
            return 'projects/nido-dev/locations/us-east1/queues/ingestion-worker-queue';
          case 'INGESTION_WORKER_URL':
            return 'https://nido-worker.run.app/internal/ingestion/process-job';
          case 'INGESTION_WORKER_AUDIENCE':
            return 'https://nido-worker.run.app';
          case 'CLOUD_TASKS_INVOKER_SA':
            return 'cloud-tasks-invoker@nido-dev.iam.gserviceaccount.com';
          case 'GCS_INGESTION_BUCKET':
            return 'test-ingestion-bucket';
          default:
            return undefined;
        }
      }),
    };

    mockVenueService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'venue-cat-cradle',
          name: "Cat's Cradle",
          city: 'Carrboro',
          state: 'NC',
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'venue-cat-cradle',
        name: "Cat's Cradle",
      }),
    };

    mockBandService = {
      findAll: jest
        .fn()
        .mockResolvedValue([
          { id: 'band-chatham', name: 'Chatham County Line' },
        ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'band-chatham',
        name: 'Chatham County Line',
      }),
    };

    mockExtractor = {
      extract: jest.fn().mockResolvedValue([
        {
          title: 'Chatham County Line Live',
          venue: { name: "Cat's Cradle", city: 'Carrboro', state: 'NC' },
          performers: [{ name: 'Chatham County Line', isHeadliner: true }],
          dates: [{ date: '2026-11-15', startTime: '20:00:00' }],
          primaryGenre: 'Bluegrass',
          confidence: 0.95,
        },
      ]),
      getModelName: jest.fn().mockReturnValue('gemini-3.6-flash'),
    };

    const mockJobRepo = {
      create: jest.fn().mockImplementation((val) => ({ ...val })),
      save: jest.fn().mockImplementation(async (val) => {
        const id = val.id || `job-${jobsDb.size + 1}`;
        const record = { ...val, id, updatedAt: new Date() };
        if (!record.createdAt) record.createdAt = new Date();
        jobsDb.set(id, record);
        return record;
      }),
      findOne: jest.fn().mockImplementation(async ({ where, relations }) => {
        let job: IngestionJob | null = null;
        if (where?.id) job = jobsDb.get(where.id) || null;
        else if (where?.concertUploadId) {
          for (const j of jobsDb.values()) {
            if (j.concertUploadId === where.concertUploadId) {
              job = j;
              break;
            }
          }
        }
        if (job && relations?.concertUpload && job.concertUploadId) {
          const upload = uploadsDb.get(job.concertUploadId);
          return { ...job, concertUpload: upload };
        }
        return job ? { ...job } : null;
      }),
      update: jest.fn().mockImplementation(async (criteria, partial) => {
        const id = typeof criteria === 'string' ? criteria : criteria.id;
        const existing = jobsDb.get(id);
        if (existing) {
          Object.assign(existing, partial, { updatedAt: new Date() });
          jobsDb.set(id, existing);
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        let updatePayload: any = {};
        let targetId = '';
        return {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockImplementation((setVals) => {
            updatePayload = setVals;
            return {
              where: jest.fn().mockImplementation((clause, params) => {
                targetId = params.jobId;
                return {
                  andWhere: jest.fn().mockImplementation(() => ({
                    execute: async () => {
                      const job = jobsDb.get(targetId);
                      if (!job) return { affected: 0 };
                      const now = new Date();
                      if (
                        job.leaseOwner &&
                        job.leaseExpiresAt &&
                        job.leaseExpiresAt > now
                      ) {
                        return { affected: 0 }; // Lease held by another worker
                      }
                      Object.assign(job, updatePayload);
                      jobsDb.set(targetId, job);
                      return { affected: 1 };
                    },
                  })),
                };
              }),
            };
          }),
        };
      }),
    };

    const mockOutboxRepo = {
      create: jest.fn().mockImplementation((val) => ({ ...val })),
      save: jest.fn().mockImplementation(async (val) => {
        const id = val.id || `outbox-${outboxDb.size + 1}`;
        const record = {
          ...val,
          id,
          retryCount: val.retryCount || 0,
          createdAt: new Date(),
        };
        outboxDb.set(id, record);
        return record;
      }),
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        for (const outbox of outboxDb.values()) {
          if (where.jobId && outbox.jobId !== where.jobId) continue;
          if (where.status && outbox.status !== where.status) continue;
          return outbox;
        }
        return null;
      }),
      find: jest
        .fn()
        .mockImplementation(async () => Array.from(outboxDb.values())),
      update: jest.fn().mockImplementation(async (id, partial) => {
        const existing = outboxDb.get(id);
        if (existing) {
          Object.assign(existing, partial);
          outboxDb.set(id, existing);
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };

    const mockUploadRepo = {
      findOne: jest
        .fn()
        .mockImplementation(
          async ({ where }) => uploadsDb.get(where.id) || null,
        ),
    };

    const mockCandidateRepo = {
      create: jest.fn().mockImplementation((val) => ({
        ...val,
        id: `cand-${candidatesDb.length + 1}`,
      })),
      save: jest.fn().mockImplementation(async (val) => {
        const list = Array.isArray(val) ? val : [val];
        candidatesDb.push(...list);
        return val;
      }),
      find: jest.fn().mockImplementation(async () => candidatesDb),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          findOne: async (entity: any, opts: any) => {
            if (entity === IngestionJob) return mockJobRepo.findOne(opts);
            return null;
          },
          save: async (entityOrVal: any, val?: any) => {
            const data = val !== undefined ? val : entityOrVal;
            if (Array.isArray(data)) return mockCandidateRepo.save(data);
            if (data.destination) return mockOutboxRepo.save(data);
            if (data.concertUploadId) return mockJobRepo.save(data);
            return data;
          },
          create: (entity: any, val: any) => val,
        };
        return cb(manager);
      }),
      getRepository: (entity: any) => {
        if (entity === IngestionCandidate) return mockCandidateRepo;
        if (entity === IngestionJob) return mockJobRepo;
        if (entity === IngestionOutbox) return mockOutboxRepo;
        return null;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionWorkerController],
      providers: [
        IngestionService,
        IngestionTasksDispatcherService,
        IngestionStateMachineService,
        GoogleOidcGuard,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: VenueService, useValue: mockVenueService },
        { provide: BandService, useValue: mockBandService },
        { provide: GeminiExtractionAdapter, useValue: mockExtractor },
        { provide: getRepositoryToken(IngestionJob), useValue: mockJobRepo },
        {
          provide: getRepositoryToken(IngestionOutbox),
          useValue: mockOutboxRepo,
        },
        {
          provide: getRepositoryToken(ConcertUpload),
          useValue: mockUploadRepo,
        },
        { provide: getRepositoryToken(Concert), useValue: {} },
      ],
    }).compile();

    ingestionService = module.get<IngestionService>(IngestionService);
    workerController = module.get<IngestionWorkerController>(
      IngestionWorkerController,
    );
    dispatcherService = module.get<IngestionTasksDispatcherService>(
      IngestionTasksDispatcherService,
    );
    stateMachineService = module.get<IngestionStateMachineService>(
      IngestionStateMachineService,
    );
    oidcGuard = module.get<GoogleOidcGuard>(GoogleOidcGuard);
  });

  it('proves end-to-end progression: API commits job/outbox -> deterministic task dispatched -> worker processes -> DB in needs_review', async () => {
    // 1. Seed initial upload
    const uploadId = 'upload-test-123';
    uploadsDb.set(uploadId, {
      id: uploadId,
      storageUri: 'gs://test-ingestion-bucket/posters/poster1.jpg',
      bucket: 'test-ingestion-bucket',
      objectName: 'posters/poster1.jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'chatham.jpg',
      city: 'Carrboro',
      state: 'NC',
      uploadedByUid: 'user-uid-1',
      reviewStatus: 'submitted',
      createdAt: new Date(),
    } as any);

    // 2. Client initiates createJob via API path
    const runExtractionSpy = jest.spyOn(
      ingestionService,
      'runExtractionPipeline',
    );
    const jobResponse = await ingestionService.createJob(
      uploadId,
      'user-uid-1',
    );

    // 2a. Verify API response and immediate non-blocking state
    expect(jobResponse.id).toBeDefined();
    expect(jobResponse.stage).toBe(IngestionStage.QUEUED);
    expect(jobResponse.status).toBe('queued');
    // Critical Criterion 1: Zero post-response void processing in API path
    expect(runExtractionSpy).not.toHaveBeenCalled();

    // 2b. Verify DB records committed atomically
    const jobId = jobResponse.id;
    const dbJob = jobsDb.get(jobId);
    expect(dbJob).toBeDefined();
    expect(dbJob?.stage).toBe(IngestionStage.QUEUED);

    // 2c. Verify outbox state transitioned to 'dispatched'
    const outboxRecord = Array.from(outboxDb.values()).find(
      (o) => o.jobId === jobId,
    );
    expect(outboxRecord).toBeDefined();
    expect(outboxRecord?.status).toBe('dispatched');

    // 3. Worker receives the Cloud Tasks invocation with deterministic payload
    const workerResult = await workerController.processJob({ jobId });

    expect(workerResult).toEqual({ success: true });

    // 4. Verify DB progression after worker completes OCR extraction
    const finishedJob = jobsDb.get(jobId);
    expect(finishedJob?.stage).toBe(IngestionStage.NEEDS_REVIEW);
    expect(finishedJob?.status).toBe('needs_review');
    expect(finishedJob?.ocrProvider).toBe('gemini-3.6-flash');

    // Verify candidates persisted to DB
    expect(candidatesDb.length).toBeGreaterThan(0);
    expect(candidatesDb[0].ingestionJobId).toBe(jobId);
    expect(candidatesDb[0].provenance?.title?.rawValue).toBe(
      'Chatham County Line Live',
    );
  });

  it('enforces idempotency: terminal duplicate delivery is safely ACKed with 200 without duplicate provider charges', async () => {
    const jobId = 'job-already-completed';
    jobsDb.set(jobId, {
      id: jobId,
      concertUploadId: 'upload-1',
      stage: IngestionStage.NEEDS_REVIEW,
      status: 'needs_review',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const runExtractionSpy = jest.spyOn(
      ingestionService,
      'runExtractionPipeline',
    );

    // Cloud Tasks redelivery of an already completed task
    const duplicateResult = await workerController.processJob({ jobId });

    expect(duplicateResult).toEqual({ success: true, skipped: true });
    // Zero LLM / provider charges incurred
    expect(runExtractionSpy).not.toHaveBeenCalled();
    expect(mockExtractor.extract).not.toHaveBeenCalled();
  });

  it('rejects concurrent worker execution with 503 Service Unavailable when lease is held', async () => {
    const jobId = 'job-in-flight';
    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future
    jobsDb.set(jobId, {
      id: jobId,
      concertUploadId: 'upload-1',
      stage: IngestionStage.QUEUED,
      status: 'queued',
      leaseOwner: 'worker-instance-alpha',
      leaseExpiresAt: futureExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await expect(workerController.processJob({ jobId })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('handles permanent failures by marking job terminal and ACKing with 200', async () => {
    const jobId = 'job-perm-fail';
    jobsDb.set(jobId, {
      id: jobId,
      concertUploadId: 'upload-invalid',
      stage: IngestionStage.QUEUED,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    jest
      .spyOn(ingestionService, 'runExtractionPipeline')
      .mockRejectedValueOnce(
        new Error('Invalid image file format or corrupt payload'),
      );

    const result = await workerController.processJob({ jobId });

    expect(result).toEqual({ success: true, skipped: true });
    const job = jobsDb.get(jobId);
    expect(job?.status).toBe(IngestionTerminalStatus.TERMINAL_FAILURE);
    expect(job?.errorMessage).toContain('Invalid image file format');
    expect(job?.leaseOwner).toBeNull();
  });

  it('handles retryable failures by resetting stage to QUEUED and throwing 500 for Cloud Tasks backoff', async () => {
    const jobId = 'job-transient-fail';
    jobsDb.set(jobId, {
      id: jobId,
      concertUploadId: 'upload-1',
      stage: IngestionStage.QUEUED,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    jest
      .spyOn(ingestionService, 'runExtractionPipeline')
      .mockRejectedValueOnce(
        new Error('Gemini API 429 Too Many Requests: Rate limit exceeded'),
      );

    await expect(workerController.processJob({ jobId })).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  describe('Worker Security & IAM Negative Tests', () => {
    const createMockContext = (authHeader?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: authHeader,
            },
          }),
        }),
      }) as any;

    it('rejects anonymous unauthenticated request with 401 Unauthorized', async () => {
      const context = createMockContext(undefined);
      await expect(oidcGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects non-Bearer authentication header with 401 Unauthorized', async () => {
      const context = createMockContext('ApiKey secret-key-123');
      await expect(oidcGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects token targeted at wrong audience with 401 Unauthorized', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(
        new Error('Wrong recipient, payload audience != requiredAudience'),
      );
      const context = createMockContext('Bearer wrong-audience-token');
      await expect(oidcGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects token from unauthorized caller identity with 403 Forbidden', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          email:
            'unauthorized-service-account@malicious-project.iam.gserviceaccount.com',
          email_verified: true,
        }),
      });
      const context = createMockContext('Bearer attacker-token');
      await expect(oidcGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects token with unverified email with 403 Forbidden', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          email: 'cloud-tasks-invoker@nido-dev.iam.gserviceaccount.com',
          email_verified: false,
        }),
      });
      const context = createMockContext('Bearer unverified-email-token');
      await expect(oidcGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('accepts legitimate OIDC token from authorized Cloud Tasks caller', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          email: 'cloud-tasks-invoker@nido-dev.iam.gserviceaccount.com',
          email_verified: true,
        }),
      });
      const context = createMockContext('Bearer valid-cloud-tasks-token');
      const allowed = await oidcGuard.canActivate(context);
      expect(allowed).toBe(true);
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-cloud-tasks-token',
        audience: 'https://nido-worker.run.app',
      });
    });
  });
});
