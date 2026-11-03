import { z } from 'zod';

export const evaluatePostFeedbackInputSchema = z
  .object({
    postId: z.string().trim().min(1).describe('The Beehiiv post ID to evaluate.'),
    draftContent: z
      .string()
      .trim()
      .optional()
      .describe('Original draft content (markdown or HTML) to compare against published version.'),
  })
  .strict();

export const entityClickAffinitySchema = z
  .object({
    entityName: z.string().describe('Artist or venue name.'),
    type: z.enum(['artist', 'venue', 'general']).describe('Entity classification.'),
    clicks: z.number().int().describe('Total clicks logged on links referencing entity.'),
    uniqueClicks: z.number().int().describe('Unique user clicks.'),
    affinityWeight: z.number().describe('Calculated curation affinity multiplier (1.0 to 2.5).'),
  })
  .strict();

export const evaluatePostFeedbackOutputSchema = z
  .object({
    postId: z.string().describe('Evaluated post ID.'),
    openRate: z.number().describe('Email open rate percentage (0 to 1).'),
    clickRate: z.number().describe('Email click rate percentage (0 to 1).'),
    totalClicks: z.number().int().describe('Total clicks recorded across all links.'),
    retainedShows: z.array(z.string()).describe('Shows from draft retained in final post.'),
    addedShows: z.array(z.string()).describe('Shows added by human editor.'),
    removedShows: z.array(z.string()).describe('Shows removed by human editor.'),
    voiceCalibrations: z.array(z.string()).describe('Editorial voice calibration suggestions.'),
    topPerformers: z.array(z.string()).describe('Top clicked entities and their weights.'),
    curationAdvice: z.array(z.string()).describe('Actionable advice for subsequent newsletter curation.'),
  })
  .strict();
