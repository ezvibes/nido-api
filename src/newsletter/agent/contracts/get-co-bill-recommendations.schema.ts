import { z } from 'zod';
import {
  DEFAULT_CO_BILL_LOOKBACK_MONTHS,
  DEFAULT_CO_BILL_RESULTS,
  MAX_CO_BILL_ANCHORS,
  MAX_CO_BILL_LOOKBACK_MONTHS,
  MAX_CO_BILL_RESULTS,
  MAX_CO_BILL_SHARED_BILLS,
  MAX_CO_BILL_PREFERRED_VENUES,
  MAX_CO_BILL_TARGET_RANGE_DAYS,
  MAX_CO_BILL_VENUE_NAME_LENGTH,
} from '../../newsletter.constants';

export const getCoBillRecommendationsInputSchema = z
  .object({
    anchorBandIds: z
      .array(z.uuid())
      .min(1)
      .max(MAX_CO_BILL_ANCHORS)
      .describe(
        'UUIDs of trusted anchor artists used to discover co-billed acts.',
      ),
    targetDateRange: z
      .object({
        start: z.iso
          .datetime({ offset: true })
          .describe('Inclusive ISO 8601 start of the upcoming concert range.'),
        end: z.iso
          .datetime({ offset: true })
          .describe('Inclusive ISO 8601 end of the upcoming concert range.'),
      })
      .strict()
      .refine((range) => new Date(range.start) <= new Date(range.end), {
        message: 'The target start must be before or equal to the end.',
        path: ['end'],
      })
      .refine(
        (range) =>
          new Date(range.end).getTime() - new Date(range.start).getTime() <=
          MAX_CO_BILL_TARGET_RANGE_DAYS * 24 * 60 * 60 * 1_000,
        {
          message: `The target range cannot exceed ${MAX_CO_BILL_TARGET_RANGE_DAYS} days.`,
          path: ['end'],
        },
      ),
    preferredVenues: z
      .array(z.string().trim().min(1).max(MAX_CO_BILL_VENUE_NAME_LENGTH))
      .max(MAX_CO_BILL_PREFERRED_VENUES)
      .optional()
      .describe('Optional exact venue names used to narrow upcoming concerts.'),
    historicalLookbackMonths: z
      .number()
      .int()
      .min(1)
      .max(MAX_CO_BILL_LOOKBACK_MONTHS)
      .default(DEFAULT_CO_BILL_LOOKBACK_MONTHS)
      .describe('Months of historical shared bills to inspect.'),
    minimumSharedBills: z
      .number()
      .int()
      .min(1)
      .max(MAX_CO_BILL_SHARED_BILLS)
      .default(1)
      .describe('Minimum number of distinct historical shared bills required.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_CO_BILL_RESULTS)
      .default(DEFAULT_CO_BILL_RESULTS)
      .describe('Maximum number of evidence-backed recommendations to return.'),
  })
  .strict();

const bandEvidenceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(255),
  })
  .strict();

const venueEvidenceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(255),
    city: z.string().min(1).max(255),
    region: z.string().min(1).max(255),
  })
  .strict();

export const coBillRecommendationSchema = z
  .object({
    candidateBand: bandEvidenceSchema,
    connection: z
      .object({
        anchorBandId: z.uuid(),
        anchorBandName: z.string().min(1).max(255),
        sharedBillCount: z.number().int().min(1),
      })
      .strict(),
    upcomingConcert: z
      .object({
        id: z.uuid(),
        title: z.string().min(1).max(255),
        startsAt: z.iso.datetime({ offset: true }),
        venue: venueEvidenceSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const getCoBillRecommendationsOutputSchema = z
  .object({
    recommendations: z
      .array(coBillRecommendationSchema)
      .max(MAX_CO_BILL_RESULTS),
    count: z.number().int().min(0).max(MAX_CO_BILL_RESULTS),
  })
  .strict();

export type GetCoBillRecommendationsInput = z.infer<
  typeof getCoBillRecommendationsInputSchema
>;
export type GetCoBillRecommendationsOutput = z.infer<
  typeof getCoBillRecommendationsOutputSchema
>;
