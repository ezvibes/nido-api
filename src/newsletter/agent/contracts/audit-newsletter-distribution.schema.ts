import { z } from 'zod';

export const auditNewsletterDistributionInputSchema = z
  .object({
    events: z
      .array(
        z.object({
          artistName: z.string().trim().min(1).describe('Headlining or featured artist name.'),
          venueName: z.string().trim().min(1).describe('Concert venue name.'),
          city: z.string().trim().optional().describe('City where concert occurs.'),
          genres: z.array(z.string().trim()).optional().describe('Associated genres.'),
          date: z.string().trim().optional().describe('Concert date string.'),
        }),
      )
      .min(1)
      .max(100)
      .describe('Array of candidate or curated concert events to audit.'),
  })
  .strict();

export const auditNewsletterDistributionOutputSchema = z
  .object({
    totalEvents: z.number().int().describe('Total number of events evaluated.'),
    isBalanced: z.boolean().describe('Whether both regional and genre diversity criteria are met.'),
    underrepresentedRegions: z.array(z.string()).describe('NC regions with zero or deficient representation.'),
    underrepresentedGenres: z.array(z.string()).describe('Core genres with zero representation.'),
    alerts: z.array(z.string()).describe('Immediate representation alerts.'),
    scoutingRecommendations: z.array(z.string()).describe('Specific venue or artist scouting recommendations.'),
  })
  .strict();
