import { z } from 'zod';
import { CanonicalConcert } from './concert.contract';

export const NewsletterShowDetailsSchema = z.object({
  concertTitle: z.string().min(1, 'Concert title is required in show details'),
  venueName: z.string().min(1, 'Venue name is required in show details'),
  dateFormatted: z.string().min(1, 'Date formatted is required in show details'),
  timeFormatted: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
});

export type NewsletterShowDetails = z.infer<typeof NewsletterShowDetailsSchema>;

export const CanonicalEntityIdsSchema = z.object({
  concertId: z.string().min(1, 'Canonical concert ID is required'),
  venueId: z.string().nullable().optional(),
  bandIds: z.array(z.string()).optional().default([]),
});

export type CanonicalEntityIds = z.infer<typeof CanonicalEntityIdsSchema>;

export const CuratedNewsletterCardSchema = z.object({
  headline: z.string().min(1, 'Headline is required'),
  showDetails: z.union([z.string().min(1), NewsletterShowDetailsSchema]),
  ticketLink: z.string().nullable().optional(),
  editorialBlurb: z.string().min(1, 'Editorial blurb is required'),
  canonicalEntityIds: CanonicalEntityIdsSchema,
});

export type CuratedNewsletterCard = z.infer<typeof CuratedNewsletterCardSchema>;

/**
 * Creates a CuratedNewsletterCard from a canonical concert (or concert entity) and editorial blurb.
 * Non-destructive: does not mutate the concert or catalog data.
 */
export function toCuratedNewsletterCard(
  concert: CanonicalConcert | Record<string, any>,
  editorialBlurb: string,
  customHeadline?: string,
): CuratedNewsletterCard {
  if (!concert || typeof concert !== 'object') {
    throw new Error('Cannot create CuratedNewsletterCard from non-object');
  }

  const concertId = concert.id;
  if (!concertId) {
    throw new Error('Concert ID is required to create CuratedNewsletterCard');
  }

  const rawAny = concert as any;
  const venueName = concert.venue?.name ?? rawAny.venueName ?? 'Unknown Venue';
  const venueId = concert.venue?.id ?? rawAny.venueId ?? null;
  const bandIds: string[] = Array.isArray(concert.lineup)
    ? concert.lineup.map((b: any) => b.id || b.bandId || b.band?.id).filter(Boolean)
    : [];

  const headline = customHeadline || concert.title || 'Featured Concert';
  const dateFormatted =
    (concert as any).localEventDate ||
    (rawAny.startsAt
      ? new Date(rawAny.startsAt).toISOString().slice(0, 10)
      : 'TBD');

  const card = {
    headline,
    showDetails: {
      concertTitle: concert.title || headline,
      venueName,
      dateFormatted,
      timeFormatted: concert.startTime || null,
      genre: concert.genre || null,
    },
    ticketLink: concert.ticketUrl || null,
    editorialBlurb,
    canonicalEntityIds: {
      concertId,
      venueId,
      bandIds,
    },
  };

  return CuratedNewsletterCardSchema.parse(card);
}
