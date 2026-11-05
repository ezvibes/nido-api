import { z } from 'zod';
import { CanonicalVenueSchema, toCanonicalVenue } from './venue.contract';
import { CanonicalBandSchema, toCanonicalBand } from './band.contract';

export const PerformanceRoleSchema = z.enum([
  'headliner',
  'co-headliner',
  'support',
  'opener',
]);

export type PerformanceRole = z.infer<typeof PerformanceRoleSchema>;

export const CanonicalLineupEntrySchema = z.object({
  band: CanonicalBandSchema,
  role: PerformanceRoleSchema.nullable().optional(),
  order: z.number().int().min(0).nullable().optional(),
  setTime: z.string().nullable().optional(),
});

export type CanonicalLineupEntry = z.infer<typeof CanonicalLineupEntrySchema>;

export const CanonicalConcertSchema = z.object({
  id: z.string().min(1, 'Concert ID is required'),
  title: z.string().min(1, 'Concert title is required'),
  venue: CanonicalVenueSchema,
  lineup: z.array(CanonicalLineupEntrySchema),
  localEventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'localEventDate must be YYYY-MM-DD'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  doorTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'doorTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  ticketUrl: z.string().nullable().optional(),
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
  let lineup: CanonicalLineupEntry[] = [];
  if (Array.isArray(rawConcert.lineup)) {
    const sorted = [...rawConcert.lineup].sort((a, b) => {
      const orderA = a.performanceOrder ?? a.order ?? a.billingOrder ?? 999;
      const orderB = b.performanceOrder ?? b.order ?? b.billingOrder ?? 999;
      return orderA - orderB;
    });
    lineup = sorted.map((item: any) => {
      const bandSource = item.band ?? item;
      const band = toCanonicalBand(bandSource);
      const rawRole = item.performanceRole ?? item.role ?? null;
      let role: PerformanceRole | null = null;
      if (typeof rawRole === 'string') {
        const lower = rawRole.toLowerCase();
        if (lower === 'headliner' || lower === 'co-headliner' || lower === 'support' || lower === 'opener') {
          role = lower as PerformanceRole;
        }
      }
      const order =
        typeof item.performanceOrder === 'number'
          ? item.performanceOrder
          : typeof item.order === 'number'
          ? item.order
          : typeof item.billingOrder === 'number'
          ? item.billingOrder
          : null;

      return {
        band,
        role,
        order,
        setTime: item.setTime ?? null,
      };
    });
  }

  // Derive date and time from startsAt or explicit fields
  let localEventDate: string | undefined = rawConcert.localEventDate;
  let startTime: string | null = rawConcert.startTime ?? null;

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
    startTime: startTime ?? null,
    doorTime: rawConcert.doorTime ?? rawConcert.doorsTime ?? null,
    ticketUrl,
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
