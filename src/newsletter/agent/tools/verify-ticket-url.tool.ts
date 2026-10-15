import { FunctionTool } from '@google/adk';
import { TicketUrlVerificationService } from '../../ticket-url-verification.service';
import {
  verifyTicketUrlInputSchema,
  verifyTicketUrlOutputSchema,
} from '../contracts/verify-ticket-url.schema';

export const VERIFY_TICKET_URL_TOOL_NAME = 'verifyTicketUrl';

export function createVerifyTicketUrlTool(
  verificationService: TicketUrlVerificationService,
): FunctionTool<typeof verifyTicketUrlInputSchema> {
  return new FunctionTool({
    name: VERIFY_TICKET_URL_TOOL_NAME,
    description:
      'Checks a bounded batch of public ticket URLs and classifies each as reachable, unreachable, blocked by network policy, or indeterminate.',
    parameters: verifyTicketUrlInputSchema,
    execute: async ({ urls }) => {
      const results = await verificationService.verifyUrls(urls);
      const summary = {
        reachable: results.filter(({ status }) => status === 'reachable')
          .length,
        unreachable: results.filter(({ status }) => status === 'unreachable')
          .length,
        blocked: results.filter(({ status }) => status === 'blocked').length,
        indeterminate: results.filter(
          ({ status }) => status === 'indeterminate',
        ).length,
      };

      return verifyTicketUrlOutputSchema.parse({ results, summary });
    },
  });
}
