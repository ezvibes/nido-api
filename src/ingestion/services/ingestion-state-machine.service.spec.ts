import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, UpdateResult } from 'typeorm';
import { IngestionStateMachineService } from './ingestion-state-machine.service';
import { IngestionJob } from '../entities/ingestion-job.entity';
import {
  IngestionStage,
  IngestionTerminalStatus,
} from '../interfaces/ingestion-enums';
import { IngestionOutbox } from '../entities/ingestion-outbox.entity';

describe('IngestionStateMachineService', () => {
  let service: IngestionStateMachineService;
  let jobRepository: jest.Mocked<Repository<IngestionJob>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    jobRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 } as UpdateResult),
      }),
    } as any;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn().mockImplementation((type, obj) => obj),
        };
        return cb(manager);
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionStateMachineService,
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: jobRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<IngestionStateMachineService>(
      IngestionStateMachineService,
    );
  });

  describe('transitionTo', () => {
    it('should throw error if job not found', async () => {
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb) => {
          const manager = { findOne: jest.fn().mockResolvedValue(null) };
          return cb(manager);
        },
      );

      await expect(
        service.transitionTo('job-1', IngestionStage.ASSET_VALIDATED),
      ).rejects.toThrow('Job job-1 not found');
    });

    it('should return false if job is in terminal status', async () => {
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb) => {
          const manager = {
            findOne: jest.fn().mockResolvedValue({
              status: IngestionTerminalStatus.TERMINAL_FAILURE,
            }),
          };
          return cb(manager);
        },
      );

      const result = await service.transitionTo(
        'job-1',
        IngestionStage.ASSET_VALIDATED,
      );
      expect(result).toBe(false);
    });

    it('should return false if target stage is same or earlier than current stage', async () => {
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb) => {
          const manager = {
            findOne: jest.fn().mockResolvedValue({
              stage: IngestionStage.OCR_COMPLETED,
              status: 'processing',
            }),
          };
          return cb(manager);
        },
      );

      const result = await service.transitionTo(
        'job-1',
        IngestionStage.ASSET_VALIDATED,
      );
      expect(result).toBe(false);
    });

    it('should transition and return true for valid forward progression', async () => {
      let savedJob: any;
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb) => {
          const manager = {
            findOne: jest.fn().mockResolvedValue({
              stage: IngestionStage.QUEUED,
              status: 'queued',
            }),
            save: jest.fn().mockImplementation((job) => {
              savedJob = job;
            }),
          };
          return cb(manager);
        },
      );

      const result = await service.transitionTo(
        'job-1',
        IngestionStage.ASSET_VALIDATED,
      );
      expect(result).toBe(true);
      expect(savedJob.stage).toBe(IngestionStage.ASSET_VALIDATED);
      expect(savedJob.status).toBe(IngestionStage.ASSET_VALIDATED);
    });
  });

  describe('claimJob', () => {
    it('should return true when claim succeeds', async () => {
      const result = await service.claimJob('job-1', 'worker-1', 1000);
      expect(result).toBe(true);
    });

    it('should return false when claim fails (already claimed)', async () => {
      jobRepository.createQueryBuilder().execute = jest
        .fn()
        .mockResolvedValue({ affected: 0 } as UpdateResult);
      const result = await service.claimJob('job-1', 'worker-1', 1000);
      expect(result).toBe(false);
    });
  });

  describe('dispatchTask', () => {
    it('should create an outbox record transactionally', async () => {
      let savedOutbox: any;
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb) => {
          const manager = {
            create: jest.fn().mockImplementation((type, obj) => obj),
            save: jest.fn().mockImplementation((outbox) => {
              savedOutbox = outbox;
            }),
          };
          return cb(manager);
        },
      );

      await service.dispatchTask('job-1', 'cloud-tasks', { some: 'payload' });
      expect(savedOutbox).toBeDefined();
      expect(savedOutbox.jobId).toBe('job-1');
      expect(savedOutbox.destination).toBe('cloud-tasks');
      expect(savedOutbox.payload).toEqual({ some: 'payload' });
    });
  });
});
