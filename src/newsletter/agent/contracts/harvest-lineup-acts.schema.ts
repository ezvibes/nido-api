import { z } from 'zod';

export const harvestLineupActsInputSchema = z
  .object({
    sourceType: z
      .enum(['support_act', 'festival_lineup'])
      .describe('Source type: support acts from co-bills or festival multi-band rosters.'),
    rawText: z
      .string()
      .trim()
      .min(1)
      .describe('Raw concert title or multiline/comma-separated festival roster text.'),
    sourceTitle: z
      .string()
      .trim()
      .optional()
      .describe('Optional source title (e.g. "Shakori Hills Grassroots Festival").'),
    autoCreateInDb: z
      .boolean()
      .default(false)
      .describe('Whether to auto-register newly discovered bands as unfeatured candidates in the database.'),
  })
  .strict();

export const discoveredArtistCandidateSchema = z
  .object({
    name: z.string().describe('Normalized artist name.'),
    slug: z.string().describe('URL-friendly unique slug.'),
    sourceType: z.enum(['support_act', 'festival_lineup']).describe('Extraction origin.'),
    sourceTitle: z.string().optional().describe('Festival or headliner context.'),
    isKnownCoreRoster: z.boolean().describe('Whether band is in EZ Vibes CRM core roster.'),
    isInDatabase: z.boolean().describe('Whether band exists in the database.'),
    actionTaken: z
      .enum(['ALREADY_EXISTS', 'PROPOSED_FOR_CRM', 'CREATED_IN_CATALOG'])
      .describe('Action outcome for this candidate.'),
  })
  .strict();

export const harvestLineupActsOutputSchema = z
  .object({
    totalExtracted: z.number().int().describe('Total number of artist names parsed.'),
    newDiscoveriesCount: z.number().int().describe('Number of previously untracked artists discovered.'),
    candidates: z.array(discoveredArtistCandidateSchema).describe('Detailed list of evaluated artist candidates.'),
    summary: z.string().describe('Human-readable extraction summary.'),
  })
  .strict();
