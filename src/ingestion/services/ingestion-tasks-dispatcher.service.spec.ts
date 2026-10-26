import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { IngestionTasksDispatcherService } from './ingestion-tasks-dispatcher.service';
import { IngestionOutbox } from '../entities/ingestion-outbox.entity';

jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => {
      return {
        createTask: jest.fn().mockResolvedValue([{ name: 'projects/test/locations/test/queues/test/tasks/task1' }]),
      };
    }),
  };
});

describe('IngestionTasksDispatcherService', () => {
  let service: IngestionTasksDispatcherService;
  let mockConfigService: Partial<ConfigService>;
  let mockDataSource: Partial<DataSource>;
  let mockManager: Partial<EntityManager>;
  let mockOutboxRepository: Partial<Repository<IngestionOutbox>>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'INGESTION_ASYNC_DISPATCH_ENABLED') return 'true';
        if (key === 'CLOUD_TASKS_QUEUE_PATH') return 'projects/test-project/locations/test-location/queues/test-queue';
        if (key === 'INGESTION_WORKER_AUDIENCE') return 'https://test-worker-url/audience';
        if (key === 'INGESTION_WORKER_URL') return 'https://test-worker-url/process';
        if (key === 'CLOUD_TASKS_INVOKER_SA') return 'test-sa@test-project.iam.gserviceaccount.com';
        return undefined;
      }),
    };

    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockManager);
      }),
    };

    mockOutboxRepository = { update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionTasksDispatcherService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(IngestionOutbox), useValue: mockOutboxRepository },
      ],
    }).compile();

    service = module.get<IngestionTasksDispatcherService>(IngestionTasksDispatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not dispatch if not enabled', async () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key) => {
      if (key === 'INGESTION_ASYNC_DISPATCH_ENABLED') return 'false';
      return 'test';
    });
    const newService = new IngestionTasksDispatcherService(
      mockConfigService as any,
      mockDataSource as any,
      mockOutboxRepository as any,
    );

    await newService.dispatchJob('job-1');
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });

  it('should dispatch successfully and update outbox to dispatched', async () => {
    const mockOutbox = {
      id: 'outbox-1',
      jobId: 'job-1',
      status: 'pending',
      retryCount: 0,
    };
    (mockManager.findOne as jest.Mock).mockResolvedValue(mockOutbox);

    // We already mocked CloudTasksClient in jest.mock above
    const clientInstance = (service as any).tasksClient;
    const createTaskSpy = jest.spyOn(clientInstance, 'createTask').mockResolvedValue([{ name: 'test' }]);

    await service.dispatchJob('job-1');

    expect(createTaskSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: 'projects/test-project/locations/test-location/queues/test-queue',
        task: expect.objectContaining({
          name: 'projects/test-project/locations/test-location/queues/test-queue/tasks/job-job-1',
          httpRequest: expect.objectContaining({
            url: 'https://test-worker-url/process',
            oidcToken: {
              serviceAccountEmail: 'test-sa@test-project.iam.gserviceaccount.com',
              audience: 'https://test-worker-url/audience',
            },
          }),
        }),
      })
    );

    expect(mockOutboxRepository.update).toHaveBeenCalledWith('outbox-1',
      expect.objectContaining({
        status: 'dispatched',
      })
    );
  });

  it('should increment retryCount on failure', async () => {
    const mockOutbox = {
      id: 'outbox-2',
      jobId: 'job-2',
      status: 'pending',
      retryCount: 0,
    };
    (mockManager.findOne as jest.Mock).mockResolvedValue(mockOutbox);

    const clientInstance = (service as any).tasksClient;
    const createTaskSpy = jest.spyOn(clientInstance, 'createTask').mockRejectedValue(new Error('Network Error'));

    await service.dispatchJob('job-2');

    expect(mockOutboxRepository.update).toHaveBeenCalledWith('outbox-2',
      expect.objectContaining({
        retryCount: 1,
        lastAttemptAt: expect.any(Date),
      })
    );
  });
});
