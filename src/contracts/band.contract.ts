import { z } from 'zod';

export const CanonicalBandSchema = z.object({
  id: z.string().min(1, 'Band ID is required'),
  name: z.string().min(1, 'Band name is required'),
  genres: z.array(z.string()).nullable().optional(),
});

export type CanonicalBand = z.infer<typeof CanonicalBandSchema>;

/**
 * Maps a TypeORM Band entity or raw boundary object to CanonicalBand.
 * Non-destructive: does not mutate the source entity or invent fake defaults.
 */
export function toCanonicalBand(
  rawBand: Record<string, any> | null | undefined,
): CanonicalBand {
  if (!rawBand || typeof rawBand !== 'object') {
    throw new Error('Cannot map non-object to CanonicalBand');
  }

  const candidate = {
    id: rawBand.id,
    name: rawBand.name,
    genres: Array.isArray(rawBand.genres) ? [...rawBand.genres] : null,
  };

  return CanonicalBandSchema.parse(candidate);
}
