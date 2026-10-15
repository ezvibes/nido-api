import { ConcertSyncSchedulerService } from './concert-sync-scheduler.service';

describe('ConcertSyncSchedulerService', () => {
  let scheduler: ConcertSyncSchedulerService;
  let configService: { get: jest.Mock };
  let syncService: { createJobForOwner: jest.Mock };
  let userRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const mockUser = {
    id: 1,
    email: 'sync-bot@example.com',
    uid: 'sync-bot-system-uid',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    syncService = {
      createJobForOwner: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    userRepository = {
      findOne: jest.fn().mockResolvedValue(mockUser),
      save: jest.fn(),
      create: jest.fn(),
    };

    scheduler = new ConcertSyncSchedulerService(
      configService as any,
      syncService as any,
      userRepository as any,
    );
  });

  it('runs sync for all calendars', async () => {
    await scheduler['runScheduledSync']();

    expect(syncService.createJobForOwner).toHaveBeenCalledTimes(2);
    expect(syncService.createJobForOwner).toHaveBeenCalledWith(
      mockUser,
      expect.objectContaining({ calendarId: 'ezvibesinc@gmail.com' }),
    );
    expect(syncService.createJobForOwner).toHaveBeenCalledWith(
      mockUser,
      expect.objectContaining({
        calendarId:
          'https://www.jambase.com/calendar/8540E6A6-9ED5-43D6-A7C9-A442AF57E0F0/ical.ics',
      }),
    );
  });

  it('continues syncing remaining calendars if one fails', async () => {
    syncService.createJobForOwner
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 'job-2' });

    await scheduler['runScheduledSync']();

    expect(syncService.createJobForOwner).toHaveBeenCalledTimes(2);
  });

  it('executes calendar syncs concurrently', async () => {
    // Each job takes 100ms
    const delay = 100;
    syncService.createJobForOwner.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, delay)),
    );

    const start = Date.now();
    await scheduler['runScheduledSync']();
    const elapsed = Date.now() - start;

    // If sequential, elapsed would be >= 200ms.
    // If concurrent, elapsed should be approximately 100ms (< 180ms).
    console.log(`Execution time for scheduled sync: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(180);
  });
});
