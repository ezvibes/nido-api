import { z } from 'zod';
import { CanonicalVenueSchema, toCanonicalVenue } from './venue.contract';
import { CanonicalBandSchema, toCanonicalBand } from './band.contract';

export const PriceRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string().optional(),
  raw: z.string().optional(),
});

export type PriceRange = z.infer<typeof PriceRangeSchema>;

export const CanonicalConcertSchema = z.object({
  id: z.string().min(1, 'Concert ID is required'),
  title: z.string().min(1, 'Concert title is required'),
  venue: CanonicalVenueSchema,
  lineup: z.array(CanonicalBandSchema),
  localEventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'localEventDate must be YYYY-MM-DD'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM or HH:MM:SS'),
  doorTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'doorTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  ticketUrl: z.string().nullable().optional(),
  priceRange: z.union([z.string(), PriceRangeSchema]).nullable().optional(),
  ageRestriction: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  catalogStatus: z.enum(['active', 'hidden', 'archived']).nullable().optional(),
  isAdminApproved: z.boolean().nullable().optional(),
});

export type CanonicalConcert = z.infer<typeof CanonicalConcertSchema>;

/**
 * Maps a TypeORM Concert entity or raw boundary object to CanonicalConcert.
 * Non-destructive: does not mutate the source entity or invent fake defaults.
 */
export function toCanonicalConcert(
  rawConcert: Record<string, any> | null | undefined,
): CanonicalConcert {
  if (!rawConcert || typeof rawConcert !== 'object') {
    throw new Error('Cannot map non-object to CanonicalConcert');
  }

  // Map venue reference
  const venueSource = rawConcert.venue ?? (rawConcert.venueId ? { id: rawConcert.venueId, name: rawConcert.venueName, city: rawConcert.city, region: rawConcert.state || rawConcert.region } : null);
  const venue = toCanonicalVenue(venueSource);

  // Map ordered lineup
  let lineup: any[] = [];
  if (Array.isArray(rawConcert.lineup)) {
    lineup = rawConcert.lineup
      .map((item: any) => {
        const bandSource = item.band ?? item;
        return toCanonicalBand(bandSource, item);
      })
      .sort((a, b) => {
        const orderA = a.billingOrder ?? 999;
        const orderB = b.billingOrder ?? 999;
        return orderA - orderB;
      });
  }

  // Derive date and time from startsAt or explicit fields
  let localEventDate: string | undefined = rawConcert.localEventDate;
  let startTime: string | undefined = rawConcert.startTime;

  if (rawConcert.startsAt) {
    const startsAtDate =
      rawConcert.startsAt instanceof Date
        ? rawConcert.startsAt
        : new Date(rawConcert.startsAt);
    if (!Number.isNaN(startsAtDate.getTime())) {
      const iso = startsAtDate.toISOString();
      if (!localEventDate) {
        localEventDate = iso.slice(0, 10);
      }
      if (!startTime) {
        startTime = iso.slice(11, 19);
      }
    }
  }

  // Extract ticket link if present directly or embedded in description
  let ticketUrl = rawConcert.ticketUrl ?? null;
  if (!ticketUrl && typeof rawConcert.description === 'string') {
    const urlMatch = rawConcert.description.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      ticketUrl = urlMatch[0];
    }
  }

  const candidate = {
    id: rawConcert.id,
    title: rawConcert.title,
    venue,
    lineup,
    localEventDate,
    startTime,
    doorTime: rawConcert.doorTime ?? rawConcert.doorsTime ?? null,
    ticketUrl,
    priceRange: rawConcert.priceRange ?? rawConcert.ticketPrice ?? null,
    ageRestriction: rawConcert.ageRestriction ?? null,
    genre: rawConcert.genre ?? null,
    catalogStatus: rawConcert.catalogStatus ?? null,
    isAdminApproved:
      typeof rawConcert.isAdminApproved === 'boolean'
        ? rawConcert.isAdminApproved
        : null,
  };

  return CanonicalConcertSchema.parse(candidate);
}
