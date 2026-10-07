import { z } from 'zod';
import {
  MAX_NEWSLETTER_CATALOG_RANGE_DAYS,
  MAX_NEWSLETTER_CATALOG_RESULTS,
} from '../../newsletter.constants';

const filterValueSchema = z.string().trim().min(1).max(120);

export const fetchApprovedConcertsInputSchema = z
  .object({
    startDate: z.iso
      .datetime({ offset: true })
      .describe('Inclusive ISO 8601 start date and time.'),
    endDate: z.iso
      .datetime({ offset: true })
      .describe('Inclusive ISO 8601 end date and time.'),
    region: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .default('NC')
      .describe('Venue region or state filter. Defaults to NC.'),
    cities: z
      .array(filterValueSchema)
      .max(20)
      .optional()
      .describe('Optional city names to include.'),
    genres: z
      .array(filterValueSchema)
      .max(20)
      .optional()
      .describe('Optional genre labels to include.'),
    venues: z
      .array(filterValueSchema)
      .max(20)
      .optional()
      .describe('Optional venue names to include.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_NEWSLETTER_CATALOG_RESULTS)
      .default(20)
      .describe('Maximum number of concerts to return.'),
  })
  .strict()
  .refine(
    ({ startDate, endDate }) =>
      new Date(startDate).getTime() <= new Date(endDate).getTime(),
    {
      message: 'The start date must be before or equal to the end date.',
      path: ['endDate'],
    },
  )
  .refine(
    ({ startDate, endDate }) =>
      new Date(endDate).getTime() - new Date(startDate).getTime() <=
      MAX_NEWSLETTER_CATALOG_RANGE_DAYS * 24 * 60 * 60 * 1_000,
    {
      message: `The date range cannot exceed ${MAX_NEWSLETTER_CATALOG_RANGE_DAYS} days.`,
      path: ['endDate'],
    },
  );

export const approvedNewsletterConcertSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    date: z.string(),
    venue: z.string(),
    artists: z.string().optional(),
    genre: z.string().optional(),
    description: z.string().optional(),
    rawText: z.string().optional(),
    isTopPick: z.boolean(),
    topPickScore: z.number().finite(),
    isHighlightArtist: z.boolean(),
    isPartnerArtist: z.boolean(),
    source: z.literal('Nido Concert Database'),
  })
  .strict();

export const fetchApprovedConcertsOutputSchema = z
  .object({
    concerts: z
      .array(approvedNewsletterConcertSchema)
      .max(MAX_NEWSLETTER_CATALOG_RESULTS),
    count: z.number().int().min(0).max(MAX_NEWSLETTER_CATALOG_RESULTS),
  })
  .strict();

export type FetchApprovedConcertsInput = z.infer<
  typeof fetchApprovedConcertsInputSchema
>;

export type FetchApprovedConcertsOutput = z.infer<
  typeof fetchApprovedConcertsOutputSchema
>;
