import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { NewsletterCatalogService } from '../newsletter-catalog.service';
import { NewsletterCoBillService } from '../newsletter-co-bill.service';
import { BeehiivService } from '../beehiiv.service';
import { TicketUrlVerificationService } from '../ticket-url-verification.service';
import { createFetchApprovedConcertsTool } from './tools/fetch-approved-concerts.tool';
import { createGetCoBillRecommendationsTool } from './tools/get-co-bill-recommendations.tool';
import { createStageBeehiivDraftTool } from './tools/stage-beehiiv-draft.tool';
import { createVerifyTicketUrlTool } from './tools/verify-ticket-url.tool';

@Injectable()
export class NewsletterAgentToolRegistry {
  private readonly tools: readonly FunctionTool[];

  constructor(
    catalogService: NewsletterCatalogService,
    coBillService: NewsletterCoBillService,
    verificationService: TicketUrlVerificationService,
    beehiivService: BeehiivService,
  ) {
    this.tools = Object.freeze([
      createFetchApprovedConcertsTool(catalogService),
      createGetCoBillRecommendationsTool(coBillService),
      createVerifyTicketUrlTool(verificationService),
      createStageBeehiivDraftTool(beehiivService),
    ]);
  }

  /** Returns a copy so callers cannot mutate the application tool registry. */
  getTools(): FunctionTool[] {
    return [...this.tools];
  }
}
