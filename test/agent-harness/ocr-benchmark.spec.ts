import { OCRBenchmarkRunner } from '../../src/scripts/benchmark-ocr-providers';
import * as path from 'path';

describe('OCR Benchmark Runner', () => {
  let runner: OCRBenchmarkRunner;

  beforeEach(() => {
    runner = new OCRBenchmarkRunner(true);
  });

  it('correctly scores a perfect match', () => {
    const fixture = {
      id: 'test',
      difficulty_class: 'clean_single_event',
      title: 'Summer Jazz',
      performers: ['The Blue Notes'],
      venue: 'Jazz Club',
      date: '2026-08-15',
      start_time: '20:00:00',
      timezone: 'America/New_York',
      genre: 'Jazz',
      uploader_hints: {}
    };

    const actual = {
      title: 'Summer Jazz',
      performers: ['The Blue Notes'],
      venue: 'Jazz Club',
      date: '2026-08-15',
      start_time: '20:00:00',
      timezone: 'America/New_York',
      genre: 'Jazz',
    };

    const score = runner.scoreExtraction(fixture, actual, fixture.uploader_hints);

    expect(score.precision).toBe(1);
    expect(score.recall).toBe(1);
    expect(score.conflicts).toHaveLength(0);
  });

  it('correctly scores partial matches', () => {
    const fixture = {
      id: 'test',
      difficulty_class: 'clean_single_event',
      title: 'Summer Jazz',
      performers: ['The Blue Notes', 'Artist 2'],
      venue: 'Jazz Club',
      date: '2026-08-15',
      start_time: '20:00:00',
      timezone: 'America/New_York',
      genre: 'Jazz',
      uploader_hints: {}
    };

    const actual = {
      title: 'Summer Jazz',
      performers: ['The Blue Notes'], // Missing one
      venue: 'Wrong Club', // Incorrect
      // Missing date and time
    };

    const score = runner.scoreExtraction(fixture, actual, fixture.uploader_hints);

    expect(score.precision).toBeLessThan(1);
    expect(score.recall).toBeLessThan(1);
    expect(score.conflicts).toHaveLength(0);
  });

  it('preserves both values and warns on conflicting hints', () => {
    const fixture = {
      id: 'test',
      difficulty_class: 'conflicting_hints',
      title: 'Pop Event',
      performers: ['Pop Star'],
      venue: 'Grand Arena',
      date: '2026-12-01',
      start_time: '19:00:00',
      timezone: 'America/New_York',
      genre: 'Pop',
      uploader_hints: {
        venue: 'Wrong Arena' // Conflict
      }
    };

    const actual = {
      title: 'Pop Event',
      performers: ['Pop Star'],
      venue: 'Grand Arena', // Correct extraction
      date: '2026-12-01',
      start_time: '19:00:00',
    };

    const score = runner.scoreExtraction(fixture, actual, fixture.uploader_hints);

    expect(score.conflicts).toHaveLength(1);
    expect(score.conflicts[0]).toContain("Conflict on venue: Poster says 'Grand Arena', Hint says 'Wrong Arena'");
  });

  it('offline runner executes without network access', async () => {
    const result = await runner.run();
    expect(result.pureVision.count).toBeGreaterThan(0);
    expect(result.pureGemini.count).toBeGreaterThan(0);
    expect(result.hybridCascade.count).toBeGreaterThan(0);
  });
});
