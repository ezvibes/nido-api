import { z } from 'zod';

export const CanonicalCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CanonicalCoordinates = z.infer<typeof CanonicalCoordinatesSchema>;

export const VenueVerificationStateSchema = z.enum([
  'unverified',
  'verified',
  'flagged',
  'canonical',
]);

export type VenueVerificationState = z.infer<typeof VenueVerificationStateSchema>;

export const CanonicalVenueSchema = z.object({
  id: z.string().min(1, 'Venue ID is required'),
  name: z.string().min(1, 'Venue name is required'),
  address: z.string().nullable().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  coordinates: CanonicalCoordinatesSchema.nullable().optional(),
  verificationState: VenueVerificationStateSchema.nullable().optional(),
});

export type CanonicalVenue = z.infer<typeof CanonicalVenueSchema>;

/**
 * Maps a TypeORM Venue entity or raw boundary object to CanonicalVenue.
 * Non-destructive: does not mutate the source entity or invent fake defaults.
 */
export function toCanonicalVenue(raw: Record<string, any> | null | undefined): CanonicalVenue {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot map non-object to CanonicalVenue');
  }

  // TypeORM Venue entity uses `region` for state/province
  const state = raw.state ?? raw.region ?? undefined;

  const candidate = {
    id: raw.id,
    name: raw.name,
    address: raw.address ?? null,
    city: raw.city,
    state,
    postalCode: raw.postalCode ?? raw.postal_code ?? null,
    capacity: raw.capacity !== undefined ? raw.capacity : null,
    coordinates: raw.coordinates ?? (raw.latitude != null && raw.longitude != null ? {
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
    } : null),
    verificationState: raw.verificationState ?? raw.verification_state ?? null,
  };

  return CanonicalVenueSchema.parse(candidate);
}
