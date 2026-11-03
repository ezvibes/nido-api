import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { BeehiivService, BeehiivPostStats } from '../../beehiiv.service';
import { NewsletterFeedbackLoopService } from '../../newsletter-feedback-loop.service';
import {
  evaluatePostFeedbackInputSchema,
  evaluatePostFeedbackOutputSchema,
} from '../contracts/evaluate-post-feedback.schema';

export const EVALUATE_POST_FEEDBACK_TOOL_NAME = 'evaluatePostFeedback';

const logger = new Logger('EvaluatePostFeedbackTool');

export function createEvaluatePostFeedbackTool(
  beehiivService: BeehiivService,
  feedbackService: NewsletterFeedbackLoopService,
): FunctionTool<typeof evaluatePostFeedbackInputSchema> {
  return new FunctionTool({
    name: EVALUATE_POST_FEEDBACK_TOOL_NAME,
    description:
      'Evaluates post-publication diffs and reader engagement click metrics from Beehiiv to calibrate editorial voice and calculate artist/venue affinity weights.',
    parameters: evaluatePostFeedbackInputSchema,
    execute: async ({ postId, draftContent }) => {
      logger.log(
        `[ADK Tool Executed] evaluatePostFeedback({ postId: "${postId}" })`,
      );

      // 1. Fetch post stats
      let stats: BeehiivPostStats = {
        id: postId,
        open_rate: 0,
        click_rate: 0,
        total_clicks: 0,
        links: [],
      };
      try {
        stats = await beehiivService.getPostStats(postId);
      } catch (err: any) {
        logger.warn(`Could not fetch post stats for ${postId}: ${err.message}`);
      }

      // 2. Fetch published content if draft content was provided for diffing
      let diffReport = {
        retainedShows: [] as string[],
        addedShows: [] as string[],
        removedShows: [] as string[],
        voiceCalibrations: [] as string[],
      };

      if (draftContent) {
        try {
          const post = await beehiivService.getPost(postId);
          const publishedHtml = post.content?.free?.web || '';
          diffReport = feedbackService.diffDraftVsPublished(
            postId,
            draftContent,
            publishedHtml,
          );
        } catch (err: any) {
          logger.warn(`Could not run post diff for ${postId}: ${err.message}`);
        }
      }

      // 3. Compute affinities and curation advice
      const affinityReport = feedbackService.calculateEngagementAffinities(stats);

      return evaluatePostFeedbackOutputSchema.parse({
        postId,
        openRate: stats.open_rate || 0,
        clickRate: stats.click_rate || 0,
        totalClicks: stats.total_clicks || 0,
        retainedShows: diffReport.retainedShows,
        addedShows: diffReport.addedShows,
        removedShows: diffReport.removedShows,
        voiceCalibrations: diffReport.voiceCalibrations,
        topPerformers: affinityReport.topPerformers,
        curationAdvice: affinityReport.curationAdvice,
      });
    },
  });
}
