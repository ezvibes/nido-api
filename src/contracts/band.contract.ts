import { z } from 'zod';

export const CanonicalBandSchema = z.object({
  id: z.string().min(1, 'Band ID is required'),
  name: z.string().min(1, 'Band name is required'),
  genres: z.array(z.string()).nullable().optional(),
  isHeadliner: z.boolean().nullable().optional(),
  billingOrder: z.number().int().min(0).nullable().optional(),
});

export type CanonicalBand = z.infer<typeof CanonicalBandSchema>;

/**
 * Maps a TypeORM Band entity (optionally with ConcertBandLineup metadata) to CanonicalBand.
 * Non-destructive: does not mutate the source entity or invent fake defaults.
 */
export function toCanonicalBand(
  rawBand: Record<string, any> | null | undefined,
  lineupContext?: Record<string, any> | null,
): CanonicalBand {
  if (!rawBand || typeof rawBand !== 'object') {
    throw new Error('Cannot map non-object to CanonicalBand');
  }

  // Derive headliner state: explicit boolean, or lineup performanceRole
  let isHeadliner: boolean | null = null;
  if (typeof rawBand.isHeadliner === 'boolean') {
    isHeadliner = rawBand.isHeadliner;
  } else if (lineupContext?.performanceRole) {
    isHeadliner =
      lineupContext.performanceRole === 'headliner' ||
      lineupContext.performanceRole === 'co-headliner';
  }

  // Derive billing order: explicit number, or lineup performanceOrder
  let billingOrder: number | null = null;
  if (typeof rawBand.billingOrder === 'number') {
    billingOrder = rawBand.billingOrder;
  } else if (typeof lineupContext?.performanceOrder === 'number') {
    billingOrder = lineupContext.performanceOrder;
  }

  const candidate = {
    id: rawBand.id,
    name: rawBand.name,
    genres: Array.isArray(rawBand.genres) ? [...rawBand.genres] : null,
    isHeadliner,
    billingOrder,
  };

  return CanonicalBandSchema.parse(candidate);
}
