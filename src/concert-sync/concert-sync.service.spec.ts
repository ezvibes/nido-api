import { ConcertSyncService } from './concert-sync.service';
import { Concert } from '../apis/concerts/entities/concert.entity';

function createQueryBuilderMock() {
  const qb: Record<string, jest.Mock> = {};
  [
    'where',
    'andWhere',
    'leftJoin',
    'addSelect',
    'groupBy',
    'orderBy',
    'take',
    'update',
    'set',
  ].forEach((method) => {
    qb[method] = jest.fn().mockReturnValue(qb);
  });
  qb.getRawAndEntities = jest.fn();
  qb.execute = jest.fn();
  return qb;
}

describe('ConcertSyncService', () => {
  const jobRepository = {
    save: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const syncEventRepository = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const concertRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const calendarClient = {
    fetchAllEvents: jest.fn(),
  };
  const geminiExtractor = {
    extractConcert: jest.fn(),
    getExtractionPolicy: jest.fn(),
    getPromptTemplate: jest.fn(),
    buildPromptPreview: jest.fn(),
    getSanitizedEventPreview: jest.fn(),
  };

  let service: ConcertSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConcertSyncService(
      jobRepository as any,
      syncEventRepository as any,
      concertRepository as any,
      calendarClient as any,
      geminiExtractor as any,
    );
  });

  it('ranks all approved candidates before limiting top picks', async () => {
    const resetQb = createQueryBuilderMock();
    const selectQb = createQueryBuilderMock();
    const nearConcert = {
      id: 'near-concert',
      startsAt: new Date('2026-06-02T00:00:00.000Z'),
      isTopPick: false,
      topPickScore: null,
      topPickRefreshedAt: null,
    } as Concert;
    const laterConcert = {
      id: 'later-concert',
      startsAt: new Date('2026-06-20T00:00:00.000Z'),
      isTopPick: false,
      topPickScore: null,
      topPickRefreshedAt: null,
    } as Concert;

    concertRepository.createQueryBuilder
      .mockReturnValueOnce(resetQb)
      .mockReturnValueOnce(selectQb);
    resetQb.execute.mockResolvedValue(undefined);
    selectQb.getRawAndEntities.mockResolvedValue({
      entities: [nearConcert, laterConcert],
      raw: [
        { concert_id: 'near-concert', upvote_count: '0' },
        { concert_id: 'later-concert', upvote_count: '100' },
      ],
    });
    concertRepository.save.mockResolvedValue([nearConcert, laterConcert]);

    const result = await (service as any).refreshTopPicks(7, {
      horizonDays: 90,
      limit: 1,
      onlyUpcoming: true,
    });

    expect(selectQb.take).not.toHaveBeenCalled();
    expect(concertRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'later-concert',
          isTopPick: true,
        }),
        expect.objectContaining({
          id: 'near-concert',
          isTopPick: false,
        }),
      ]),
    );
    expect(result).toEqual({
      evaluated: 2,
      topPicks: 1,
      horizonDays: 90,
    });
  });
});
