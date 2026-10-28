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
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const mockRepo = {
      create: jest.fn().mockImplementation((val) => val),
      save: jest.fn().mockImplementation(async (val) => {
        if (Array.isArray(val)) return val;
        return { id: 'new-id', ...val };
      }),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    manager = {
      findOne: jest.fn(),
      getRepository: jest.fn().mockReturnValue(mockRepo),
      save: jest.fn().mockImplementation(async (val) => val),
    } as any;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(manager)),
      getRepository: jest.fn().mockReturnValue(mockRepo),
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

  it('should list candidates with pagination and status filter', async () => {
    const result = await service.listCandidates({ status: 'pending', limit: 10, offset: 0 });
    expect(result).toEqual({ total: 0, items: [] });
  });

  it('should get candidate details with probable duplicates query and public posterUrl', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-1';
    candidate.provenance = {
      date: { rawValue: '2026-11-07' },
    } as any;
    candidate.ingestionJob = {
      concertUpload: {
        id: 'upload-123',
        originalFilename: 'poster.jpg',
        createdAt: new Date(),
      },
    } as any;

    (dataSource.getRepository(IngestionCandidate) as any).findOne.mockResolvedValueOnce(candidate);

    const result = await service.getCandidate('cand-1');
    expect(result.candidate.id).toBe('cand-1');
    expect(result.probableDuplicates).toEqual([]);
    expect(result.upload?.posterUrl).toBe('/ingestion/uploads/upload-123/image');
  });

  it('should parse HH:mm:ss time strings and resolve venueName and bandNames in transaction', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-2';
    candidate.status = 'pending';
    candidate.ingestionJobId = 'job-2';

    manager.findOne.mockResolvedValueOnce(candidate);

    const job = new IngestionJob();
    job.id = 'job-2';
    job.concertUpload = { city: 'Raleigh', state: 'NC', genre: 'Indie Rock' } as any;
    manager.findOne.mockResolvedValueOnce(job);

    const result = await service.publishCandidate(
      'cand-2',
      {
        title: 'Sylvan Esso Live',
        date: '2026-11-07',
        time: '20:30:00',
        venueName: 'The Pour House',
        bandIds: [],
        bandNames: ['Sylvan Esso', 'Indigo De Souza'],
        genreIds: [],
        genre: 'Electronic',
        reviewDurationMs: 4200,
      },
      1,
    );

    expect(result.publishedConcertId).toBeDefined();
    expect(candidate.status).toBe('published');
  });

  it('should handle duplicate decision: publish_separately without nested transaction deadlock', async () => {
    const candidate = new IngestionCandidate();
    candidate.id = 'cand-sep';
    candidate.status = 'pending';
    candidate.ingestionJobId = 'job-sep';

    manager.findOne.mockResolvedValueOnce(candidate);

    const job = new IngestionJob();
    job.id = 'job-sep';
    job.concertUpload = {} as any;
    manager.findOne.mockResolvedValueOnce(job);

    const result = await service.handleDuplicateDecision(
      'cand-sep',
      {
        decision: 'publish_separately',
        publishData: {
          title: 'Late Night Set',
          date: '2026-11-07',
          time: '23:00',
          bandIds: ['band-1'],
          genreIds: [],
          reviewDurationMs: 3100,
        },
        reviewDurationMs: 3100,
      },
      1,
    );

    expect(result.status).toBe('published');
    expect(result.publishedConcertId).toBeDefined();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
