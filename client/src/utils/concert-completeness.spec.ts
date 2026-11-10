import { describe, it, expect } from 'vitest';
import { evaluateConcertCompleteness } from './concert-completeness';
import type { ConcertApiItem } from '../types/concerts';

describe('client evaluateConcertCompleteness', () => {
  const completeConcert: ConcertApiItem = {
    id: 'c-1',
    title: 'Wednesday w/ Hotline TNT',
    genre: 'Indie Rock',
    startsAt: '2026-11-20T20:00:00Z',
    venue: {
      id: 'v-1',
      name: "Cat's Cradle",
      city: 'Carrboro',
      region: 'NC',
    },
    lineup: [],
    sets: [],
  };

  it('marks a valid concert as complete with score 100', () => {
    const result = evaluateConcertCompleteness(completeConcert);
    expect(result.isComplete).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('flags missing venue and incomplete location', () => {
    const noVenue = evaluateConcertCompleteness({
      ...completeConcert,
      venue: null,
    });
    expect(noVenue.isComplete).toBe(false);
    expect(noVenue.missingFields).toContain('venue');

    const noCity = evaluateConcertCompleteness({
      ...completeConcert,
      venue: { id: 'v-1', name: "Cat's Cradle", city: '', region: 'NC' },
    });
    expect(noCity.isComplete).toBe(false);
    expect(noCity.missingFields).toContain('venue_city');
  });

  it('flags placeholder and empty titles', () => {
    const tbd = evaluateConcertCompleteness({
      ...completeConcert,
      title: 'TBD',
    });
    expect(tbd.isComplete).toBe(false);
    expect(tbd.missingFields).toContain('title_placeholder');
  });
});
