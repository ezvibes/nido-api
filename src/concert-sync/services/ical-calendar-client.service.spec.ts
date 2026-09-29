import { IcalCalendarClientService } from './ical-calendar-client.service';

describe('IcalCalendarClientService', () => {
  let service: IcalCalendarClientService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new IcalCalendarClientService();
  });

  it('parses public iCal events into calendar events', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(`BEGIN:VCALENDAR
X-WR-TIMEZONE:America/New_York
BEGIN:VEVENT
UID:jambase-1
SUMMARY:Mountain Walrus
LOCATION:Gregg Museum of Art & Design, 1903 Hillsborough St, Raleigh, NC 27607, USA
DTSTART:20260612T230000Z
DTEND:20260613T020000Z
DESCRIPTION:Live concert
END:VEVENT
END:VCALENDAR`),
    });

    const result = await service.fetchAllEvents({
      url: 'https://example.com/calendar.ics',
      timeMin: '2026-06-01T00:00:00.000Z',
      timeMax: '2026-07-01T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/calendar.ics',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    const firstCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Mozilla/5.0');
    expect(headers['Accept']).toContain('text/calendar');
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');

    expect(result.timeZone).toBe('America/New_York');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'jambase-1',
        summary: 'Mountain Walrus',
        location:
          'Gregg Museum of Art & Design, 1903 Hillsborough St, Raleigh, NC 27607, USA',
        start: { dateTime: '2026-06-12T23:00:00.000Z' },
        end: { dateTime: '2026-06-13T02:00:00.000Z' },
      }),
    ]);
  });

  it('automatically upgrades http:// URLs to https:// and supports ICAL_USER_AGENT env override', async () => {
    process.env.ICAL_USER_AGENT = 'CustomCalendarCrawler/2.0';
    try {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('BEGIN:VCALENDAR\nEND:VCALENDAR'),
      });

      await service.fetchAllEvents({
        url: 'http://www.jambase.com/calendar/test/ical.ics',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.jambase.com/calendar/test/ical.ics',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
      const callHeaders = callArgs[1].headers as Record<string, string>;
      expect(callHeaders['User-Agent']).toBe('CustomCalendarCrawler/2.0');
    } finally {
      delete process.env.ICAL_USER_AGENT;
    }
  });

  it('sanitizes HTML WAF error pages and extracts the title cleanly', async () => {
    const htmlChallenge = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Safeguarding Your Website — BigScoots</title>
</head>
<body>
  <h1>BigScoots Web Application Firewall</h1>
  <p>Please wait while your request is validated.</p>
</body>
</html>`;

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve(htmlChallenge),
    });

    await expect(
      service.fetchAllEvents({
        url: 'https://www.jambase.com/calendar/8540E6A6-9ED5-43D6-A7C9-A442AF57E0F0/ical.ics',
      }),
    ).rejects.toThrow(
      'iCal calendar request failed (403): Remote host returned HTML error page: "Safeguarding Your Website — BigScoots" (WAF / Anti-Bot protection challenge)',
    );
  });

  it('sanitizes HTML responses without title by stripping HTML tags', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () =>
        Promise.resolve(
          '<html><body><div>Access Denied by WAF</div></body></html>',
        ),
    });

    await expect(
      service.fetchAllEvents({
        url: 'https://example.com/calendar.ics',
      }),
    ).rejects.toThrow(
      'iCal calendar request failed (403): Remote host returned HTML block: Access Denied by WAF',
    );
  });
});
