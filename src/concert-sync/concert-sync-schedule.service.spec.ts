import { BadRequestException } from '@nestjs/common';
import { ConcertSyncScheduleService } from './concert-sync-schedule.service';

function createUpdateQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  qb.update = jest.fn().mockReturnValue(qb);
  qb.set = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn();
  return qb;
}

describe('ConcertSyncScheduleService', () => {
  const scheduleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const concertSyncService = {
    createJobForOwner: jest.fn(),
  };
  const tokenProtectionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };
  const googleOAuthTokenService = {
    exchangeRefreshToken: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let service: ConcertSyncScheduleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConcertSyncScheduleService(
      scheduleRepository as any,
      concertSyncService as any,
      tokenProtectionService as any,
      googleOAuthTokenService as any,
      configService as any,
    );
  });

  it('does not execute a schedule when another caller wins the claim', async () => {
    const updateQb = createUpdateQueryBuilder();
    const schedule = buildSchedule();

    scheduleRepository.findOne.mockResolvedValue(schedule);
    scheduleRepository.createQueryBuilder.mockReturnValue(updateQb);
    updateQb.execute.mockResolvedValue({ affected: 0 });

    await (service as any).executeSchedule(schedule.id);

    expect(tokenProtectionService.decrypt).not.toHaveBeenCalled();
    expect(googleOAuthTokenService.exchangeRefreshToken).not.toHaveBeenCalled();
    expect(concertSyncService.createJobForOwner).not.toHaveBeenCalled();
    expect(scheduleRepository.save).not.toHaveBeenCalled();
  });

  it('claims the schedule before creating a sync job', async () => {
    const updateQb = createUpdateQueryBuilder();
    const schedule = buildSchedule();

    scheduleRepository.findOne.mockResolvedValue(schedule);
    scheduleRepository.createQueryBuilder.mockReturnValue(updateQb);
    scheduleRepository.save.mockResolvedValue(undefined);
    updateQb.execute.mockResolvedValue({ affected: 1 });
    tokenProtectionService.decrypt.mockReturnValue('refresh-token');
    googleOAuthTokenService.exchangeRefreshToken.mockResolvedValue('access-token');
    concertSyncService.createJobForOwner.mockResolvedValue({ id: 'job-123' });

    await (service as any).executeSchedule(schedule.id);

    expect(updateQb.update).toHaveBeenCalled();
    expect(updateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        runStartedAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      }),
    );
    expect(tokenProtectionService.decrypt).toHaveBeenCalledWith(
      schedule.encryptedRefreshToken,
    );
    expect(googleOAuthTokenService.exchangeRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(concertSyncService.createJobForOwner).toHaveBeenCalledWith(
      schedule.owner,
      expect.objectContaining({
        calendarId: schedule.calendarId,
        googleAccessToken: 'access-token',
      }),
    );
    expect(scheduleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: schedule.id,
        lastJobId: 'job-123',
        runStartedAt: null,
      }),
    );
  });

  it('rejects manual runs while a schedule is already in flight', async () => {
    const schedule = buildSchedule({
      runStartedAt: new Date(),
    });

    scheduleRepository.findOne.mockResolvedValue(schedule);

    await expect(
      service.runScheduleNowForOwner(schedule.id, schedule.owner as any),
    ).rejects.toThrow(BadRequestException);

    expect(scheduleRepository.save).not.toHaveBeenCalled();
  });
});

function buildSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-123',
    status: 'active',
    cadenceMinutes: 60,
    lookaheadDays: 30,
    refreshTopPicks: true,
    calendarId: 'primary',
    encryptedRefreshToken: 'encrypted-token',
    geminiPrompt: null,
    geminiContext: null,
    nextRunAt: new Date('2026-05-20T12:00:00.000Z'),
    runStartedAt: null,
    lastRunAt: null,
    lastJob: null,
    lastJobId: null,
    lastError: null,
    scheduleMetadata: {},
    owner: {
      id: 42,
    },
    ...overrides,
  };
}
