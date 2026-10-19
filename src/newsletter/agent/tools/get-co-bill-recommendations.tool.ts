import { FunctionTool } from '@google/adk';
import { NewsletterCoBillService } from '../../newsletter-co-bill.service';
import {
  getCoBillRecommendationsInputSchema,
  getCoBillRecommendationsOutputSchema,
} from '../contracts/get-co-bill-recommendations.schema';

export const GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME = 'getCoBillRecommendations';

export function createGetCoBillRecommendationsTool(
  coBillService: NewsletterCoBillService,
): FunctionTool<typeof getCoBillRecommendationsInputSchema> {
  return new FunctionTool({
    name: GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME,
    description:
      'Finds artists with historical shared bills with trusted anchor bands who also have active, admin-approved upcoming concerts. Every result includes the catalog evidence behind the recommendation.',
    parameters: getCoBillRecommendationsInputSchema,
    execute: async (input) => {
      const recommendations = await coBillService.findRecommendations({
        anchorBandIds: input.anchorBandIds,
        targetStart: new Date(input.targetDateRange.start),
        targetEnd: new Date(input.targetDateRange.end),
        preferredVenues: input.preferredVenues,
        historicalLookbackMonths: input.historicalLookbackMonths,
        minimumSharedBills: input.minimumSharedBills,
        limit: input.limit,
      });

      return getCoBillRecommendationsOutputSchema.parse({
        recommendations,
        count: recommendations.length,
      });
    },
  });
}
