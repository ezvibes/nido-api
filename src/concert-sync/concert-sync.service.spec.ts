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
  const icalCalendarClient = {
    fetchAllEvents: jest.fn(),
  };
  const geminiExtractor = {
    extractConcert: jest.fn(),
    isGeminiEnabled: jest.fn(),
    getExtractionPolicy: jest.fn(),
    getPromptTemplate: jest.fn(),
    buildPromptPreview: jest.fn(),
    getSanitizedEventPreview: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let service: ConcertSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConcertSyncService(
      jobRepository as any,
      syncEventRepository as any,
      concertRepository as any,
      calendarClient as any,
      icalCalendarClient as any,
      geminiExtractor as any,
      configService as any,
    );
    configService.get.mockReturnValue(undefined);
    geminiExtractor.isGeminiEnabled.mockReturnValue(true);
    concertRepository.find.mockResolvedValue([]);
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

  it('stores dry-run previews without calling Gemini or writing concerts', async () => {
    const job = {
      id: 'job-1',
      owner: { id: 7 },
      calendarId: 'primary',
      requestedRangeStart: null,
      requestedRangeEnd: null,
      jobMetadata: {},
      totalEventsFetched: 0,
      eventsProcessed: 0,
      eventsSkipped: 0,
      status: 'queued',
    };
    const event = {
      id: 'event-1',
      status: 'confirmed',
      summary: 'Dry Run Show',
      start: { dateTime: '2026-06-01T20:00:00.000Z' },
    };

    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation(async (value) => value);
    geminiExtractor.getSanitizedEventPreview.mockReturnValue({
      id: 'event-1',
      summary: 'Dry Run Show',
    });
    geminiExtractor.buildPromptPreview.mockReturnValue('prompt preview');

    await (service as any).runJob('job-1', {
      sampleEvents: [event],
      dryRun: true,
      maxEvents: 1,
    });

    expect(geminiExtractor.extractConcert).not.toHaveBeenCalled();
    expect(concertRepository.save).not.toHaveBeenCalled();
    expect(job.status).toBe('completed');
    expect(job.eventsProcessed).toBe(1);
    expect(job.jobMetadata).toEqual(
      expect.objectContaining({
        dryRun: true,
        processableEvents: 1,
        dryRunEvents: [
          expect.objectContaining({
            id: 'event-1',
            promptPreview: 'prompt preview',
          }),
        ],
      }),
    );
  });

  it('loads public iCal calendar feeds without Google credentials', async () => {
    const job = {
      id: 'job-ical',
      owner: { id: 7 },
      calendarId: 'https://example.com/jambase.ics',
      requestedRangeStart: null,
      requestedRangeEnd: null,
      jobMetadata: {},
      totalEventsFetched: 0,
      eventsProcessed: 0,
      eventsSkipped: 0,
      status: 'queued',
    };
    const event = {
      id: 'ical-event-1',
      status: 'confirmed',
      summary: 'Jambase Show',
      start: { dateTime: '2026-06-20T20:00:00.000Z' },
    };

    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation(async (value) => value);
    icalCalendarClient.fetchAllEvents.mockResolvedValue({
      items: [event],
      timeZone: 'America/New_York',
    });
    geminiExtractor.getSanitizedEventPreview.mockReturnValue({
      id: 'ical-event-1',
      summary: 'Jambase Show',
    });
    geminiExtractor.buildPromptPreview.mockReturnValue('prompt preview');

    await (service as any).runJob('job-ical', {
      dryRun: true,
      maxEvents: 1,
    });

    expect(calendarClient.fetchAllEvents).not.toHaveBeenCalled();
    expect(icalCalendarClient.fetchAllEvents).toHaveBeenCalledWith({
      url: 'https://example.com/jambase.ics',
      timeMin: undefined,
      timeMax: undefined,
    });
    expect(job.status).toBe('completed');
    expect(job.totalEventsFetched).toBe(1);
  });

  it('records fallback reasons in job metadata', async () => {
    const job = {
      id: 'job-2',
      owner: { id: 7 },
      calendarId: 'primary',
      requestedRangeStart: null,
      requestedRangeEnd: null,
      refreshTopPicks: false,
      jobMetadata: {},
      totalEventsFetched: 0,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsSkipped: 0,
      status: 'queued',
    };
    const event = {
      id: 'event-2',
      status: 'confirmed',
      summary: 'Fallback Show',
      start: { dateTime: '2026-06-01T20:00:00.000Z' },
    };
    const concert = { id: 'concert-1' };

    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation(async (value) => value);
    syncEventRepository.find.mockResolvedValue([]);
    syncEventRepository.create.mockImplementation((value) => value);
    syncEventRepository.save.mockResolvedValue(undefined);
    concertRepository.create.mockReturnValue(concert);
    concertRepository.save.mockResolvedValue(concert);
    geminiExtractor.extractConcert.mockResolvedValue({
      title: 'Fallback Show',
      genre: 'Live',
      startsAt: '2026-06-01T20:00:00.000Z',
      endsAt: null,
      description: null,
      artists: [{ name: 'Fallback Show' }],
      venues: [],
      confidence: 0.63,
      needsGuidance: false,
      guidanceQuestions: [],
      extractionSource: 'heuristic',
      fallbackReason: 'gemini_billing_or_quota_exhausted',
      providerStatus: 429,
    });

    await (service as any).runJob('job-2', {
      sampleEvents: [event],
      maxEvents: 1,
    });

    expect(job.status).toBe('completed');
    expect(job.jobMetadata).toEqual(
      expect.objectContaining({
        geminiExtractions: 0,
        heuristicExtractions: 1,
        fallbackReasons: {
          gemini_billing_or_quota_exhausted: 1,
        },
      }),
    );
  });

  it('updates a likely duplicate manual concert instead of creating another concert', async () => {
    const existingConcert = {
      id: 'existing-concert',
      title: 'Beer and Banjos',
      startsAt: new Date('2026-06-09T22:00:00.000Z'),
      venues: [{ name: 'Bowstring Brewyard' }],
    };
    const extraction = {
      title: 'Beer & Banjos',
      genre: 'Live',
      startsAt: '2026-06-09T22:00:00.000Z',
      endsAt: null,
      description: null,
      artists: [],
      venues: [{ name: 'Bowstring Brewyard', city: 'Raleigh', state: 'NC' }],
      confidence: 0.63,
      needsGuidance: false,
      guidanceQuestions: [],
      extractionSource: 'heuristic',
    };

    concertRepository.find.mockResolvedValue([existingConcert]);
    concertRepository.save.mockImplementation(async (value) => value);

    const result = await (service as any).upsertConcertFromEvent(
      { id: 7 },
      extraction,
    );

    expect(result.wasCreated).toBe(false);
    expect(concertRepository.create).not.toHaveBeenCalled();
    expect(concertRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-concert',
        title: 'Beer & Banjos',
      }),
    );
  });
});
