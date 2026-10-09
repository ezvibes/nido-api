import { z } from 'zod';
import { MAX_TICKET_URLS_PER_CHECK } from '../../newsletter.constants';

export const verifyTicketUrlInputSchema = z
  .object({
    urls: z
      .array(
        z
          .url()
          .max(2_048)
          .refine(
            (value) => ['http:', 'https:'].includes(new URL(value).protocol),
            {
              message: 'Only HTTP(S) URLs are allowed.',
            },
          ),
      )
      .min(1)
      .max(MAX_TICKET_URLS_PER_CHECK)
      .describe('Public HTTP(S) ticket URLs to verify.'),
  })
  .strict();

const ticketUrlVerificationResultSchema = z
  .object({
    url: z.url(),
    finalUrl: z.url().optional(),
    status: z.enum(['reachable', 'unreachable', 'blocked', 'indeterminate']),
    statusCode: z.number().int().min(100).max(599).optional(),
    method: z.enum(['HEAD', 'GET']).optional(),
    reason: z.string().max(160).optional(),
  })
  .strict();

export const verifyTicketUrlOutputSchema = z
  .object({
    results: z
      .array(ticketUrlVerificationResultSchema)
      .max(MAX_TICKET_URLS_PER_CHECK),
    summary: z
      .object({
        reachable: z.number().int().min(0),
        unreachable: z.number().int().min(0),
        blocked: z.number().int().min(0),
        indeterminate: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type VerifyTicketUrlInput = z.infer<typeof verifyTicketUrlInputSchema>;
export type VerifyTicketUrlOutput = z.infer<typeof verifyTicketUrlOutputSchema>;
