import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { NewsletterLineupHarvesterService } from '../../newsletter-lineup-harvester.service';
import {
  harvestLineupActsInputSchema,
  harvestLineupActsOutputSchema,
} from '../contracts/harvest-lineup-acts.schema';

export const HARVEST_LINEUP_ACTS_TOOL_NAME = 'harvestLineupActs';

const logger = new Logger('HarvestLineupActsTool');

export function createHarvestLineupActsTool(
  harvesterService: NewsletterLineupHarvesterService,
): FunctionTool<typeof harvestLineupActsInputSchema> {
  return new FunctionTool({
    name: HARVEST_LINEUP_ACTS_TOOL_NAME,
    description:
      'Extracts supporting acts from co-bill concert titles or multi-band festival lineups, evaluating discovered artists for CRM roster expansion.',
    parameters: harvestLineupActsInputSchema,
    execute: async ({ sourceType, rawText, sourceTitle, autoCreateInDb }) => {
      logger.log(
        `[ADK Tool Executed] harvestLineupActs({ sourceType: "${sourceType}", sourceTitle: "${sourceTitle || ''}" })`,
      );

      let artistNames: string[] = [];
      if (sourceType === 'support_act') {
        const parsed = harvesterService.extractSupportActs(rawText);
        artistNames = [parsed.headliner, ...parsed.supportingActs];
      } else {
        artistNames = harvesterService.parseFestivalLineup(rawText);
      }

      const report = await harvesterService.processDiscoveredArtists(
        artistNames,
        sourceType,
        sourceTitle,
        autoCreateInDb,
      );

      return harvestLineupActsOutputSchema.parse({
        totalExtracted: report.totalExtracted,
        newDiscoveriesCount: report.newDiscoveriesCount,
        candidates: report.candidates,
        summary: report.summary,
      });
    },
  });
}
