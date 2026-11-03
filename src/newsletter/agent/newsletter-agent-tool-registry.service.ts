import { Injectable, Optional } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { NewsletterCatalogService } from '../newsletter-catalog.service';
import { NewsletterCoBillService } from '../newsletter-co-bill.service';
import { BeehiivService } from '../beehiiv.service';
import { BeehiivMcpService } from '../beehiiv-mcp.service';
import { TicketUrlVerificationService } from '../ticket-url-verification.service';
import { NewsletterDistributionAuditorService } from '../newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from '../newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from '../newsletter-feedback-loop.service';
import { createFetchApprovedConcertsTool } from './tools/fetch-approved-concerts.tool';
import { createGetCoBillRecommendationsTool } from './tools/get-co-bill-recommendations.tool';
import { createStageBeehiivDraftTool } from './tools/stage-beehiiv-draft.tool';
import { createVerifyTicketUrlTool } from './tools/verify-ticket-url.tool';
import { createAuditNewsletterDistributionTool } from './tools/audit-newsletter-distribution.tool';
import { createHarvestLineupActsTool } from './tools/harvest-lineup-acts.tool';
import { createEvaluatePostFeedbackTool } from './tools/evaluate-post-feedback.tool';

@Injectable()
export class NewsletterAgentToolRegistry {
  private readonly tools: readonly FunctionTool[];

  constructor(
    catalogService: NewsletterCatalogService,
    coBillService: NewsletterCoBillService,
    verificationService: TicketUrlVerificationService,
    beehiivService: BeehiivService,
    @Optional() beehiivMcpService?: BeehiivMcpService,
    @Optional() auditorService?: NewsletterDistributionAuditorService,
    @Optional() harvesterService?: NewsletterLineupHarvesterService,
    @Optional() feedbackService?: NewsletterFeedbackLoopService,
  ) {
    const toolList: FunctionTool[] = [
      createFetchApprovedConcertsTool(catalogService),
      createGetCoBillRecommendationsTool(coBillService),
      createVerifyTicketUrlTool(verificationService),
      createStageBeehiivDraftTool(beehiivService, beehiivMcpService),
    ];

    if (auditorService) {
      toolList.push(createAuditNewsletterDistributionTool(auditorService));
    }
    if (harvesterService) {
      toolList.push(createHarvestLineupActsTool(harvesterService));
    }
    if (feedbackService) {
      toolList.push(createEvaluatePostFeedbackTool(beehiivService, feedbackService));
    }

    this.tools = Object.freeze(toolList);
  }

  /** Returns a copy so callers cannot mutate the application tool registry. */
  getTools(): FunctionTool[] {
    return [...this.tools];
  }
}
