import { z } from 'zod';

export const stageBeehiivDraftInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('Human-readable Beehiiv draft title.'),
    htmlContent: z
      .string()
      .trim()
      .min(1)
      .max(500_000)
      .describe('HTML newsletter content to stage for editorial review.'),
    postTemplateId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe('Optional Beehiiv post template identifier.'),
    status: z
      .literal('draft')
      .describe('Required draft-only status. Publishing is not permitted.'),
  })
  .strict();

export const stageBeehiivDraftOutputSchema = z
  .object({
    id: z.string().min(1).max(160),
    title: z.string().min(1).max(200),
    subtitle: z.string().optional(),
    status: z.literal('draft'),
    web_url: z.url().optional(),
    created_at: z.number().int().nonnegative().optional(),
  })
  .strict();

export type StageBeehiivDraftInput = z.infer<
  typeof stageBeehiivDraftInputSchema
>;
export type StageBeehiivDraftOutput = z.infer<
  typeof stageBeehiivDraftOutputSchema
>;
