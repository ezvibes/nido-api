import { z } from 'zod';

export const ExtractedVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required when venue is present'),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

export type ExtractedVenue = z.infer<typeof ExtractedVenueSchema>;

export const ExtractedPerformerSchema = z.object({
  name: z.string().min(1, 'Performer name is required'),
  isHeadliner: z.boolean().optional().default(false),
  setTime: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
});

export type ExtractedPerformer = z.infer<typeof ExtractedPerformerSchema>;

export const ExtractedDateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must match YYYY-MM-DD format'),
  doorsTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'doorsTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'startTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  timezone: z.string().nullable().optional(),
  warning: z.string().nullable().optional(),
});

export type ExtractedDate = z.infer<typeof ExtractedDateSchema>;

export const PosterExtractionResultSchema = z.object({
  title: z.string().nullable().optional(),
  venue: ExtractedVenueSchema.nullable().optional(),
  performers: z.array(ExtractedPerformerSchema).nullable().optional(),
  dates: z.array(ExtractedDateSchema).nullable().optional(),
  genre: z.string().nullable().optional(),
  primaryGenre: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
  isFestival: z.boolean().nullable().optional(),
  ticketPrice: z.string().nullable().optional(),
  ageRestriction: z.string().nullable().optional(),
  promotersAndSponsors: z.array(z.string()).nullable().optional(),
  ticketUrlOrInfo: z.string().nullable().optional(),
  rawOcrText: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  uncertainty: z.string().nullable().optional(),
  warnings: z.array(z.string()).nullable().optional(),
  uploaderConflicts: z.array(z.string()).nullable().optional(),
});

export type PosterExtractionResult = z.infer<typeof PosterExtractionResultSchema>;

/**
 * Validates raw Gemini extraction payload against the canonical PosterExtractionResult schema.
 * Rejects malformed or incomplete output before persisting candidates.
 */
export function validatePosterExtractionResult(
  candidate: unknown,
): PosterExtractionResult {
  return PosterExtractionResultSchema.parse(candidate);
}

/**
 * Validates an array of extraction results.
 */
export function validatePosterExtractionResults(
  candidates: unknown,
): PosterExtractionResult[] {
  return z.array(PosterExtractionResultSchema).parse(candidates);
}
