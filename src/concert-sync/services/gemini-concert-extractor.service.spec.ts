import { GeminiConcertExtractorService } from './gemini-concert-extractor.service';

describe('GeminiConcertExtractorService', () => {
  const configService = {
    get: jest.fn(),
  };

  let service: GeminiConcertExtractorService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(undefined);
    service = new GeminiConcertExtractorService(configService as any);
  });

  it('parses Google location strings into clean fallback venue fields', async () => {
    const extraction = await service.extractConcert(
      {
        id: 'event-1',
        status: 'confirmed',
        summary: 'Beer & Banjos',
        location:
          'Bowstring Brewyard, 1930 Wake Forest Rd, Raleigh, NC 27608, USA',
        start: {
          dateTime: '2026-06-09T18:00:00-04:00',
          timeZone: 'America/New_York',
        },
      },
      {},
    );

    expect(extraction.venues).toEqual([
      {
        name: 'Bowstring Brewyard',
        city: 'Raleigh',
        state: 'NC',
        country: 'USA',
      },
    ]);
  });

  it('uses heuristic extraction with the current default model when Gemini is disabled', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'CONCERT_SYNC_GEMINI_ENABLED' ? 'false' : undefined,
    );

    const extraction = await service.extractConcert(
      {
        id: 'event-2',
        status: 'confirmed',
        summary: 'Doctor S Presents: Neon Tide with DJ Luna',
        location: 'The Evening Muse, Charlotte, NC',
        start: {
          dateTime: '2026-07-10T20:00:00-04:00',
          timeZone: 'America/New_York',
        },
      },
      {},
    );

    expect(extraction).toMatchObject({
      extractionSource: 'heuristic',
      fallbackReason: 'gemini_disabled',
      model: 'gemini-2.5-flash',
    });
  });
});
