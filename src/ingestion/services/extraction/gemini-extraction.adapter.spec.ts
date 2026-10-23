import { Test, TestingModule } from '@nestjs/testing';
import { GeminiExtractionAdapter } from './gemini-extraction.adapter';
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
});
