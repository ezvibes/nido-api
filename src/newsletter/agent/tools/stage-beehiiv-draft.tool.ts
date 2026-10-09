import { FunctionTool } from '@google/adk';
import { BeehiivService } from '../../beehiiv.service';
import {
  stageBeehiivDraftInputSchema,
  stageBeehiivDraftOutputSchema,
} from '../contracts/stage-beehiiv-draft.schema';

export const STAGE_BEEHIIV_DRAFT_TOOL_NAME = 'stageBeehiivDraft';

export function createStageBeehiivDraftTool(
  beehiivService: BeehiivService,
): FunctionTool<typeof stageBeehiivDraftInputSchema> {
  return new FunctionTool({
    name: STAGE_BEEHIIV_DRAFT_TOOL_NAME,
    description:
      'Stages a draft-only Beehiiv newsletter for human editorial review. This tool cannot publish or send a post.',
    parameters: stageBeehiivDraftInputSchema,
    requireConfirmation: true,
    execute: async ({ title, htmlContent, postTemplateId }) => {
      const draft = await beehiivService.createDraftFromHtml({
        title,
        htmlContent,
        postTemplateId,
      });

      return stageBeehiivDraftOutputSchema.parse(draft);
    },
  });
}
