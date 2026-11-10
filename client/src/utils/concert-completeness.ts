import type { ConcertApiItem } from '../types/concerts';

export interface ConcertCompletenessResult {
  isComplete: boolean;
  score: number;
  missingFields: string[];
}

const INVALID_PLACEHOLDER_TITLES = new Set([
  'tbd',
  'tba',
  'private event',
  'cancelled',
  'canceled',
  'untitled',
  'closed',
  'no show',
]);

/**
 * Deterministically evaluates whether a concert in the client UI satisfies
 * the minimum data completeness requirements for catalog discovery.
 */
export function evaluateConcertCompleteness(
  concert: Partial<ConcertApiItem> | null | undefined,
): ConcertCompletenessResult {
  const missingFields: string[] = [];

  if (!concert) {
    return {
      isComplete: false,
      score: 0,
      missingFields: ['concert'],
    };
  }

  // 1. Title validation
  const title = concert.title?.trim();
  if (!title || title.length < 2) {
    missingFields.push('title');
  } else if (INVALID_PLACEHOLDER_TITLES.has(title.toLowerCase())) {
    missingFields.push('title_placeholder');
  }

  // 2. Scheduled date validation
  if (!concert.startsAt) {
    missingFields.push('startsAt');
  } else {
    const startsAtDate = new Date(concert.startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      missingFields.push('startsAt_invalid');
    }
  }

  // 3. Venue & location validation
  const venue = concert.venue;
  if (!venue) {
    missingFields.push('venue');
  } else {
    if (!venue.name || venue.name.trim().length < 2) {
      missingFields.push('venue_name');
    }
    if (!venue.city || venue.city.trim().length < 2) {
      missingFields.push('venue_city');
    }
    if (!venue.region || venue.region.trim().length < 2) {
      missingFields.push('venue_state');
    }
  }

  // 4. Genre validation
  const genre = concert.genre?.trim();
  if (!genre || genre.length < 2) {
    missingFields.push('genre');
  }

  const totalChecks = 4;
  const passedChecks = Math.max(0, totalChecks - missingFields.length);
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    isComplete: missingFields.length === 0,
    score,
    missingFields,
  };
}
