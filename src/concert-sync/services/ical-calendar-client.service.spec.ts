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
      text: async () => `BEGIN:VCALENDAR
X-WR-TIMEZONE:America/New_York
BEGIN:VEVENT
UID:jambase-1
SUMMARY:Mountain Walrus
LOCATION:Gregg Museum of Art & Design, 1903 Hillsborough St, Raleigh, NC 27607, USA
DTSTART:20260612T230000Z
DTEND:20260613T020000Z
DESCRIPTION:Live concert
END:VEVENT
END:VCALENDAR`,
    });

    const result = await service.fetchAllEvents({
      url: 'https://example.com/calendar.ics',
      timeMin: '2026-06-01T00:00:00.000Z',
      timeMax: '2026-07-01T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/calendar.ics',
      expect.objectContaining({ method: 'GET' }),
    );
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
});
