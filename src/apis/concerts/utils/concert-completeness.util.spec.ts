import { evaluateConcertCompleteness } from './concert-completeness.util';
import { Venue } from '../../venues/entities/venue.entity';

describe('evaluateConcertCompleteness', () => {
  const validVenue: Partial<Venue> = {
    id: 'venue-uuid-1',
    name: "Cat's Cradle",
    city: 'Carrboro',
    region: 'North Carolina',
    regionSlug: 'nc',
  };

  it('evaluates a complete, high-quality concert as 100% complete', () => {
    const result = evaluateConcertCompleteness({
      title: 'Wednesday w/ Hotline TNT',
      genre: 'Indie Rock',
      startsAt: new Date('2026-11-20T20:00:00Z'),
      venue: validVenue as Venue,
    });

    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('rejects null or undefined concert objects', () => {
    const result = evaluateConcertCompleteness(null);
    expect(result.isComplete).toBe(false);
    expect(result.score).toBe(0);
    expect(result.missingFields).toContain('concert');
  });

  it('flags missing or placeholder titles', () => {
    const missingTitle = evaluateConcertCompleteness({
      title: '',
      genre: 'Rock',
      startsAt: new Date(),
      venue: validVenue as Venue,
    });
    expect(missingTitle.isComplete).toBe(false);
    expect(missingTitle.missingFields).toContain('title');

    const placeholderTitle = evaluateConcertCompleteness({
      title: 'TBD',
      genre: 'Rock',
      startsAt: new Date(),
      venue: validVenue as Venue,
    });
    expect(placeholderTitle.isComplete).toBe(false);
    expect(placeholderTitle.missingFields).toContain('title_placeholder');
  });

  it('flags missing or invalid dates', () => {
    const missingDate = evaluateConcertCompleteness({
      title: 'Real Estate',
      genre: 'Indie Rock',
      venue: validVenue as Venue,
    });
    expect(missingDate.isComplete).toBe(false);
    expect(missingDate.missingFields).toContain('startsAt');

    const invalidDate = evaluateConcertCompleteness({
      title: 'Real Estate',
      genre: 'Indie Rock',
      startsAt: new Date('not-a-valid-date'),
      venue: validVenue as Venue,
    });
    expect(invalidDate.isComplete).toBe(false);
    expect(invalidDate.missingFields).toContain('startsAt_invalid');
  });

  it('flags missing venue or incomplete venue location', () => {
    const missingVenue = evaluateConcertCompleteness({
      title: 'Real Estate',
      genre: 'Indie Rock',
      startsAt: new Date(),
      venue: null,
    });
    expect(missingVenue.isComplete).toBe(false);
    expect(missingVenue.missingFields).toContain('venue');

    const missingCity = evaluateConcertCompleteness({
      title: 'Real Estate',
      genre: 'Indie Rock',
      startsAt: new Date(),
      venue: { ...validVenue, city: '' } as Venue,
    });
    expect(missingCity.isComplete).toBe(false);
    expect(missingCity.missingFields).toContain('venue_city');

    const missingState = evaluateConcertCompleteness({
      title: 'Real Estate',
      genre: 'Indie Rock',
      startsAt: new Date(),
      venue: { ...validVenue, region: '', regionSlug: '' } as Venue,
    });
    expect(missingState.isComplete).toBe(false);
    expect(missingState.missingFields).toContain('venue_state');
  });

  it('flags missing genre', () => {
    const missingGenre = evaluateConcertCompleteness({
      title: 'Sylvan Esso',
      genre: '',
      startsAt: new Date(),
      venue: validVenue as Venue,
    });
    expect(missingGenre.isComplete).toBe(false);
    expect(missingGenre.missingFields).toContain('genre');
  });
});
