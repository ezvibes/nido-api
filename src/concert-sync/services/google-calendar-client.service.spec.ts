import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarClientService } from './google-calendar-client.service';

describe('GoogleCalendarClientService', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccountPrivateKey = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;

  const configService = {
    get: jest.fn(),
  };

  let service: GoogleCalendarClientService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new GoogleCalendarClientService(configService as any);
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | undefined> = {
        GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL:
          'sync-doctor@nido-demo.iam.gserviceaccount.com',
        GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY:
          serviceAccountPrivateKey.replace(/\n/g, '\\n'),
      };
      return values[key];
    });
  });

  it('uses configured service account credentials to fetch calendar events', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'service-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 'event-1', summary: 'Service Account Show' }],
          timeZone: 'America/New_York',
        }),
      });

    const result = await service.fetchAllEvents({
      calendarId: 'primary',
      timeMin: '2026-06-01T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer service-token',
        }),
      }),
    );
    expect(result).toEqual({
      items: [{ id: 'event-1', summary: 'Service Account Show' }],
      timeZone: 'America/New_York',
      nextSyncToken: undefined,
    });
  });

  it('uses an explicit request token when one is supplied', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await service.fetchAllEvents({
      accessToken: 'swagger-token',
      calendarId: 'primary',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer swagger-token',
        }),
      }),
    );
  });
});
