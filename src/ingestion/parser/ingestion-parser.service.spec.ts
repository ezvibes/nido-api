import { IngestionParserService } from './ingestion-parser.service';

describe('IngestionParserService', () => {
  let service: IngestionParserService;

  beforeEach(() => {
    service = new IngestionParserService();
  });

  it('should extract date, venue, city, artists, and genre hints from representative flyer text', () => {
    const [candidate] = service.parseOcrText(`
THE HEADLINERS + DJ MOON
Friday April 17, 2026 8:00 PM
at Cat's Cradle
Carrboro, NC
Indie rock dance party
    `);

    expect(candidate.title).toBe('THE HEADLINERS + DJ MOON');
    expect(candidate.venueName).toBe("Cat's Cradle");
    expect(candidate.city).toBe('Carrboro');
    expect(candidate.region).toBe('NC');
    expect(candidate.artistNames).toEqual(['THE HEADLINERS', 'DJ MOON']);
    expect(candidate.genreHints).toEqual(expect.arrayContaining(['rock', 'indie', 'dj']));
    expect(candidate.startAt).toBeInstanceOf(Date);
    expect(candidate.startAt?.toISOString()).toBe('2026-04-17T20:00:00.000Z');
    expect(candidate.parseWarnings).not.toContain('missing_start_date');
  });

  it('should handle numeric dates and partial extraction gracefully', () => {
    const [candidate] = service.parseOcrText(`
LATE NIGHT NOISE
04/27/2026 9:30 PM
Durham, NC
    `);

    expect(candidate.title).toBe('LATE NIGHT NOISE');
    expect(candidate.city).toBe('Durham');
    expect(candidate.region).toBe('NC');
    expect(candidate.startAt).toBeInstanceOf(Date);
    expect(candidate.startAt?.toISOString()).toBe('2026-04-27T21:30:00.000Z');
    expect(candidate.parseWarnings).toContain('missing_venue');
    expect(candidate.status).toBe('needs_review');
  });

  it('should fall back to source asset city when OCR text is sparse', () => {
    const [candidate] = service.parseOcrText('Mystery Show', { city: 'Raleigh' });

    expect(candidate.title).toBe('Mystery Show');
    expect(candidate.city).toBe('Raleigh');
    expect(candidate.parseWarnings).toEqual(
      expect.arrayContaining(['missing_start_date', 'missing_venue']),
    );
    expect(candidate.parseConfidence).toBeGreaterThan(0);
  });
});
