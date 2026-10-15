import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { NewsletterCatalogService } from '../../newsletter-catalog.service';
import {
  fetchApprovedConcertsInputSchema,
  fetchApprovedConcertsOutputSchema,
} from '../contracts/fetch-approved-concerts.schema';

export const FETCH_APPROVED_CONCERTS_TOOL_NAME = 'fetchApprovedConcerts';

const logger = new Logger('FetchApprovedConcertsTool');

export function createFetchApprovedConcertsTool(
  catalogService: NewsletterCatalogService,
): FunctionTool<typeof fetchApprovedConcertsInputSchema> {
  return new FunctionTool({
    name: FETCH_APPROVED_CONCERTS_TOOL_NAME,
    description:
      'Returns active, admin-approved Nido concerts for a bounded date range and optional location, genre, or venue filters.',
    parameters: fetchApprovedConcertsInputSchema,
    execute: async (input) => {
      logger.log(
        `[ADK Tool Executed] fetchApprovedConcerts({ startDate: "${input.startDate}", endDate: "${input.endDate}", limit: ${input.limit} })`,
      );
      const concerts = await catalogService.findApprovedConcerts({
        start: new Date(input.startDate),
        end: new Date(input.endDate),
        region: input.region,
        cities: input.cities,
        genres: input.genres,
        venues: input.venues,
        limit: input.limit,
      });

      return fetchApprovedConcertsOutputSchema.parse({
        concerts,
        count: concerts.length,
      });
    },
  });
}
