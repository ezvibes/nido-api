import { Test, TestingModule } from '@nestjs/testing';
import { IngestionWorkerController } from './ingestion-worker.controller';
import { IngestionStateMachineService } from '../services/ingestion-state-machine.service';
import { IngestionService } from '../ingestion.service';
import { GoogleOidcGuard } from '../../auth/guards/google-oidc.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { Repository } from 'typeorm';
import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { IngestionTerminalStatus } from '../interfaces/ingestion-enums';

describe('IngestionWorkerController', () => {
  let controller: IngestionWorkerController;
  let stateMachineService: Partial<IngestionStateMachineService>;
  let ingestionService: Partial<IngestionService>;
  let jobRepository: Partial<Repository<IngestionJob>>;

  beforeEach(async () => {
    stateMachineService = {
      claimJob: jest.fn().mockResolvedValue(true),
    };

    ingestionService = {
      runExtractionPipeline: jest.fn().mockResolvedValue(undefined),
    } as any;

    jobRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 'job-1', status: 'queued' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionWorkerController],
      providers: [
        { provide: IngestionStateMachineService, useValue: stateMachineService },
        { provide: IngestionService, useValue: ingestionService },
        { provide: getRepositoryToken(IngestionJob), useValue: jobRepository },
      ],
    })
    .overrideGuard(GoogleOidcGuard)
    .useValue({ canActivate: jest.fn(() => true) })
    .compile();

    controller = module.get<IngestionWorkerController>(IngestionWorkerController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should skip execution and return OK if lease cannot be claimed', async () => {
    (stateMachineService.claimJob as jest.Mock).mockResolvedValue(false);

    await expect(controller.processJob({ jobId: 'job-1' })).rejects.toThrow(ServiceUnavailableException);
  });

  it('should execute pipeline and return OK if lease is claimed', async () => {
    const result = await controller.processJob({ jobId: 'job-2' });

    expect(result).toEqual({ success: true });
    expect(stateMachineService.claimJob).toHaveBeenCalledWith('job-2', expect.any(String), expect.any(Number));
    expect(ingestionService.runExtractionPipeline).toHaveBeenCalledWith('job-2');
  });

  it('should throw InternalServerErrorException for transient errors', async () => {
    (ingestionService.runExtractionPipeline as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    await expect(controller.processJob({ jobId: 'job-3' })).rejects.toThrow(Error);
  });

  it('should skip execution if job is already terminal', async () => {
    (jobRepository.findOne as jest.Mock).mockResolvedValue({ status: IngestionTerminalStatus.TERMINAL_FAILURE });

    const result = await controller.processJob({ jobId: 'job-4' });

    expect(result).toEqual({ success: true, skipped: true });
  });
});
