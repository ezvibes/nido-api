import { ConcertSyncService } from './concert-sync.service';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';

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
    manager: {
      delete: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      transaction: jest.fn(),
    },
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

  const venueService = {
    findOrCreateByName: jest
      .fn()
      .mockResolvedValue({ id: 'venue-uuid', name: 'Mock Venue' }),
  };
  const bandService = {
    findOrCreateManyByName: jest
      .fn()
      .mockResolvedValue([{ id: 'band-uuid', name: 'Mock Band' }]),
  };

  let service: ConcertSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    concertRepository.manager.transaction.mockImplementation(
      async (
        callback: (manager: typeof concertRepository.manager) => unknown,
      ) => callback(concertRepository.manager),
    );
    service = new ConcertSyncService(
      jobRepository as any,
      syncEventRepository as any,
      concertRepository as any,
      calendarClient as any,
      icalCalendarClient as any,
      geminiExtractor as any,
      configService as any,
      venueService as any,
      bandService as any,
    );
    configService.get.mockReturnValue(undefined);
    geminiExtractor.isGeminiEnabled.mockReturnValue(true);
    concertRepository.find.mockResolvedValue([]);
  });

  it('ranks all approved candidates before limiting top picks', async () => {
    const selectQb = createQueryBuilderMock();
    const nearConcert = {
      id: 'near-concert',
      version: 2,
      startsAt: new Date('2026-06-02T00:00:00.000Z'),
      isTopPick: false,
      topPickScore: null,
      topPickRefreshedAt: null,
    } as Concert;
    const laterConcert = {
      id: 'later-concert',
      version: 4,
      startsAt: new Date('2026-06-20T00:00:00.000Z'),
      isTopPick: false,
      topPickScore: null,
      topPickRefreshedAt: null,
    } as Concert;

    const nearUpdateQb = createQueryBuilderMock();
    const laterUpdateQb = createQueryBuilderMock();
    const staleClearQb = createQueryBuilderMock();
    concertRepository.createQueryBuilder
      .mockReturnValueOnce(selectQb)
      .mockReturnValueOnce(laterUpdateQb)
      .mockReturnValueOnce(nearUpdateQb)
      .mockReturnValueOnce(staleClearQb);
    nearUpdateQb.execute.mockResolvedValue({ affected: 1 });
    laterUpdateQb.execute.mockResolvedValue({ affected: 1 });
    staleClearQb.execute.mockResolvedValue({ affected: 2 });
    selectQb.getRawAndEntities.mockResolvedValue({
      entities: [nearConcert, laterConcert],
      raw: [
        { concert_id: 'near-concert', upvote_count: '0' },
        { concert_id: 'later-concert', upvote_count: '100' },
      ],
    });
    const result = await (service as any).refreshTopPicks(7, {
      horizonDays: 90,
      limit: 1,
      onlyUpcoming: true,
    });

    expect(selectQb.take).not.toHaveBeenCalled();
    expect(staleClearQb.andWhere).toHaveBeenCalledWith(
      '(is_top_pick = true OR top_pick_score IS NOT NULL)',
    );
    expect(staleClearQb.andWhere).toHaveBeenCalledWith(
      'id NOT IN (:...retainedConcertIds)',
      { retainedConcertIds: ['later-concert', 'near-concert'] },
    );
    expect(selectQb.andWhere).toHaveBeenCalledWith(
      'concert.catalogStatus = :activeCatalogStatus',
      { activeCatalogStatus: ConcertCatalogStatus.ACTIVE },
    );
    expect(laterUpdateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ isTopPick: true }),
    );
    expect(laterUpdateQb.andWhere).toHaveBeenCalledWith(
      'version = :observedVersion',
      { observedVersion: 4 },
    );
    expect(nearUpdateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ isTopPick: false }),
    );
    expect(concertRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      evaluated: 2,
      topPicks: 1,
      horizonDays: 90,
    });
  });

  it('clears only previously ranked state when no candidates remain', async () => {
    const selectQb = createQueryBuilderMock();
    const staleClearQb = createQueryBuilderMock();
    concertRepository.createQueryBuilder
      .mockReturnValueOnce(selectQb)
      .mockReturnValueOnce(staleClearQb);
    selectQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    staleClearQb.execute.mockResolvedValue({ affected: 1 });

    const result = await (service as any).refreshTopPicks(7);

    expect(staleClearQb.andWhere).toHaveBeenCalledWith(
      '(is_top_pick = true OR top_pick_score IS NOT NULL)',
    );
    expect(staleClearQb.andWhere).not.toHaveBeenCalledWith(
      'id NOT IN (:...retainedConcertIds)',
      expect.anything(),
    );
    expect(result).toEqual({ evaluated: 0, topPicks: 0, horizonDays: 90 });
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
      version: 3,
      title: 'Beer and Banjos',
      startsAt: new Date('2026-06-09T22:00:00.000Z'),
      venue: { name: 'Bowstring Brewyard' },
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
    const updateQb = createQueryBuilderMock();
    updateQb.execute.mockResolvedValue({ affected: 1 });
    concertRepository.manager.createQueryBuilder.mockReturnValue(updateQb);
    concertRepository.manager.findOne.mockResolvedValue({
      ...existingConcert,
      title: 'Beer & Banjos',
      version: 4,
    });

    const result = await (service as any).upsertConcertFromEvent(
      { id: 7 },
      extraction,
    );

    expect(result.wasCreated).toBe(false);
    expect(concertRepository.create).not.toHaveBeenCalled();
    expect(updateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Beer & Banjos' }),
    );
    expect(updateQb.andWhere).toHaveBeenCalledWith(
      'version = :observedVersion',
      { observedVersion: 3 },
    );
  });

  it('preserves an editorially locked concert during calendar sync', async () => {
    const lockedConcert = {
      id: 'locked-concert',
      title: 'Editorial title',
      editorialLockedAt: new Date('2026-07-31T20:00:00.000Z'),
    } as Concert;
    concertRepository.findOne.mockResolvedValue(lockedConcert);

    const result = await (service as any).upsertConcertFromEvent(
      { id: 7 },
      {
        title: 'Calendar title',
        genre: 'Rock',
        startsAt: '2026-08-01T20:00:00.000Z',
        endsAt: null,
        description: null,
        artists: [{ name: 'Example Band' }],
        venues: [{ name: 'Example Venue' }],
      },
      'locked-concert',
    );

    expect(result).toEqual({
      concert: lockedConcert,
      wasCreated: false,
      wasSkipped: true,
    });
    expect(venueService.findOrCreateByName).not.toHaveBeenCalled();
    expect(bandService.findOrCreateManyByName).not.toHaveBeenCalled();
    expect(concertRepository.save).not.toHaveBeenCalled();
  });

  it('skips a stale sync update when an admin edit wins the version race', async () => {
    const staleConcert = {
      id: 'racing-concert',
      title: 'Calendar title',
      editorialLockedAt: null,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      version: 5,
    } as Concert;
    concertRepository.findOne.mockResolvedValue(staleConcert);
    const updateQb = createQueryBuilderMock();
    updateQb.execute.mockResolvedValue({ affected: 0 });
    concertRepository.manager.createQueryBuilder.mockReturnValue(updateQb);

    const result = await (service as any).upsertConcertFromEvent(
      { id: 7 },
      {
        title: 'New calendar title',
        genre: 'Rock',
        startsAt: '2026-08-01T20:00:00.000Z',
        endsAt: null,
        description: null,
        artists: [{ name: 'Example Band' }],
        venues: [{ name: 'Example Venue' }],
      },
      'racing-concert',
    );

    expect(updateQb.andWhere).toHaveBeenCalledWith(
      'version = :observedVersion',
      { observedVersion: 5 },
    );
    expect(result.wasSkipped).toBe(true);
    expect(concertRepository.manager.delete).not.toHaveBeenCalled();
    expect(concertRepository.manager.save).not.toHaveBeenCalled();
  });

  it('skips a sync update when the concert becomes archived', async () => {
    const staleConcert = {
      id: 'archiving-concert',
      title: 'Calendar title',
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      version: 8,
    } as Concert;
    concertRepository.findOne.mockResolvedValue(staleConcert);
    const updateQb = createQueryBuilderMock();
    updateQb.execute.mockResolvedValue({ affected: 0 });
    concertRepository.manager.createQueryBuilder.mockReturnValue(updateQb);

    const result = await (service as any).upsertConcertFromEvent(
      { id: 7 },
      {
        title: 'New calendar title',
        genre: 'Rock',
        startsAt: '2026-08-01T20:00:00.000Z',
        endsAt: null,
        description: null,
        artists: [{ name: 'Example Band' }],
        venues: [{ name: 'Example Venue' }],
      },
      'archiving-concert',
    );

    expect(result.wasSkipped).toBe(true);
    expect(updateQb.andWhere).toHaveBeenCalledWith(
      'catalog_status <> :archivedCatalogStatus',
      { archivedCatalogStatus: ConcertCatalogStatus.ARCHIVED },
    );
    expect(concertRepository.manager.delete).not.toHaveBeenCalled();
    expect(concertRepository.manager.save).not.toHaveBeenCalled();
  });

  it('skips locked mapped concerts before extraction and preserves the pending fingerprint', async () => {
    const job = {
      id: 'job-locked',
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
    const mapping = {
      calendarEventId: 'event-locked',
      eventFingerprint: 'previous-fingerprint',
      concert: {
        id: 'locked-concert',
        editorialLockedAt: new Date('2026-07-31T20:00:00.000Z'),
      },
    };
    const event = {
      id: 'event-locked',
      status: 'confirmed',
      summary: 'Changed calendar title',
      start: { dateTime: '2026-08-01T20:00:00.000Z' },
    };

    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation(async (value) => value);
    syncEventRepository.find.mockResolvedValue([mapping]);
    syncEventRepository.save.mockResolvedValue(mapping);

    await (service as any).runJob('job-locked', {
      sampleEvents: [event],
      maxEvents: 1,
    });

    expect(geminiExtractor.extractConcert).not.toHaveBeenCalled();
    expect(mapping.eventFingerprint).toBe('previous-fingerprint');
    expect(job.eventsSkipped).toBe(1);
    expect(job.eventsUpdated).toBe(0);
  });

  it('skips archived mapped concerts before model extraction', async () => {
    const job = {
      id: 'job-archived',
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
    const mapping = {
      calendarEventId: 'event-archived',
      eventFingerprint: 'previous-fingerprint',
      concert: {
        id: 'archived-concert',
        catalogStatus: ConcertCatalogStatus.ARCHIVED,
      },
    };
    const event = {
      id: 'event-archived',
      status: 'confirmed',
      summary: 'Changed archived show',
      start: { dateTime: '2026-08-01T20:00:00.000Z' },
    };

    jobRepository.findOne.mockResolvedValue(job);
    jobRepository.save.mockImplementation(async (value) => value);
    syncEventRepository.find.mockResolvedValue([mapping]);
    syncEventRepository.save.mockResolvedValue(mapping);

    await (service as any).runJob('job-archived', {
      sampleEvents: [event],
      maxEvents: 1,
    });

    expect(geminiExtractor.extractConcert).not.toHaveBeenCalled();
    expect(mapping.eventFingerprint).toBe('previous-fingerprint');
    expect(job.eventsSkipped).toBe(1);
    expect(job.eventsUpdated).toBe(0);
  });
});
