import { Test, TestingModule } from '@nestjs/testing';
import { GeminiExtractionAdapter, CANONICAL_GENRES } from './gemini-extraction.adapter';
import { ConfigService } from '@nestjs/config';

describe('GeminiExtractionAdapter', () => {
  let adapter: GeminiExtractionAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiExtractionAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<GeminiExtractionAdapter>(GeminiExtractionAdapter);
  });

  it('should extract a single event fixture', async () => {
    const result = await adapter.extract('test-single', 'image/jpeg');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Title');
    expect(result[0].primaryGenre).toBeDefined();
  });

  it('should extract a multi-genre festival fixture with doors time and set times', async () => {
    const result = await adapter.extract('festival', 'image/jpeg');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Carolina Music Festival');
    expect(result[0].isFestival).toBe(true);
    expect(result[0].primaryGenre).toBe('Bluegrass');
    expect(result[0].genres).toContain('Folk');
    expect(result[0].dates![0].doorsTime).toBe('18:00:00');
    expect(result[0].dates![0].startTime).toBe('19:00:00');
    expect(result[0].dates![0].timezone).toBe('America/New_York');
    expect(result[0].performers![0].setTime).toBe('21:00');
    expect(result[0].performers![0].stage).toBe('Main Stage');
    expect(result[0].ticketPrice).toBe('$25 ADV / $30 DOS');
    expect(result[0].ageRestriction).toBe('All Ages');
    expect(result[0].promotersAndSponsors).toContain('Cat\'s Cradle Presents');
  });

  it('should extract multiple events for lineup fixture', async () => {
    const result = await adapter.extract('multi', 'image/jpeg');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Test Festival');
    expect(result[1].title).toBe('Test Festival');
  });

  it('should handle malformed JSON', async () => {
    await expect(adapter.extract('malformed', 'image/jpeg')).rejects.toThrow(
      'Malformed JSON',
    );
  });

  it('should add warnings when hint conflicts with extraction', async () => {
    const result = await adapter.extract('test-single', 'image/jpeg', {
      date: '2027-01-01',
    });
    expect(result).toHaveLength(1);
    expect(result[0].dates![0].warning).toContain('Hint conflict');
  });

  it('defaults to gemini-3.8-flash and automatically upgrades retired gemini-2.5-flash', () => {
    expect(adapter.getModelName()).toBe('gemini-3.8-flash');

    const retiredAdapter = new GeminiExtractionAdapter({
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_MODEL') return 'gemini-2.5-flash';
        return null;
      }),
    } as unknown as ConfigService);
    expect(retiredAdapter.getModelName()).toBe('gemini-3.8-flash');

    const configuredAdapter = new GeminiExtractionAdapter({
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
        return null;
      }),
    } as unknown as ConfigService);
    expect(configuredAdapter.getModelName()).toBe('gemini-3.6-flash');
  });

  it('exports canonical genres matching Nido catalog standard', () => {
    expect(CANONICAL_GENRES).toContain('Jazz');
    expect(CANONICAL_GENRES).toContain('Bluegrass');
    expect(CANONICAL_GENRES).toContain('Rock');
    expect(CANONICAL_GENRES).toContain('Electronic');
  });
});
