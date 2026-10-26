import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { IngestionPublicationService } from './ingestion-publication.service';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { ConcertCatalogStatus } from '../../apis/concerts/entities/concert.entity';
import { ConflictException } from '@nestjs/common';
import { PerformanceRole } from '../../apis/concerts/entities/concert-band-lineup.entity';

describe('IngestionPublicationService', () => {
  let service: IngestionPublicationService;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn().mockImplementation((val) => val),
        save: jest.fn().mockImplementation(async (val) => {
          if (Array.isArray(val)) return val;
          return { id: 'new-id', ...val };
        }),
      }),
      save: jest.fn().mockImplementation(async (val) => val),
    } as any;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(manager)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionPublicationService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<IngestionPublicationService>(IngestionPublicationService);
  });

  it('should publish candidate in transaction', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-1';
    candidate.status = 'pending';
    candidate.ingestionJobId = 'job-1';

    manager.findOne.mockResolvedValueOnce(candidate);

    const job = new IngestionJob();
    job.id = 'job-1';
    job.concertUpload = {} as any;
    manager.findOne.mockResolvedValueOnce(job);

    const result = await service.publishCandidate('cand-1', {
      title: 'Test',
      date: '2026-01-01',
      time: '20:00',
      bandIds: ['band-1'],
      genreIds: [],
      reviewDurationMs: 5000,
    }, 1);

    expect(result.publishedConcertId).toBeDefined();
    expect(candidate.status).toBe('published');
    expect(manager.save).toHaveBeenCalledWith(candidate);
  });

  it('should return idempotent result if already published', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-1';
    candidate.status = 'published';
    candidate.publishedConcertId = 'existing-concert-id';

    manager.findOne.mockResolvedValueOnce(candidate);

    const result = await service.publishCandidate('cand-1', {
      title: 'Test',
      date: '2026-01-01',
      time: '20:00',
      bandIds: [],
      genreIds: [],
      reviewDurationMs: 5000,
    }, 1);

    expect(result.publishedConcertId).toBe('existing-concert-id');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('should handle duplicate decision: reject', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-1';
    candidate.status = 'pending';
    candidate.ingestionJobId = 'job-1';

    manager.findOne.mockResolvedValueOnce(candidate);

    const job = new IngestionJob();
    job.id = 'job-1';
    manager.findOne.mockResolvedValueOnce(job);

    const result = await service.handleDuplicateDecision('cand-1', {
      decision: 'reject',
      rejectReason: 'duplicate',
      reviewDurationMs: 5000,
    }, 1);

    expect(result.status).toBe('rejected');
    expect(candidate.status).toBe('rejected');
    expect(manager.save).toHaveBeenCalledWith(candidate);
  });
});
