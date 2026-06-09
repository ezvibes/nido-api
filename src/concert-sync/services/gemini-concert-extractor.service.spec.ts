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
});
