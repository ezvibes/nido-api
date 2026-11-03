import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { NewsletterDistributionAuditorService } from '../../newsletter-distribution-auditor.service';
import {
  auditNewsletterDistributionInputSchema,
  auditNewsletterDistributionOutputSchema,
} from '../contracts/audit-newsletter-distribution.schema';

export const AUDIT_NEWSLETTER_DISTRIBUTION_TOOL_NAME =
  'auditNewsletterDistribution';

const logger = new Logger('AuditNewsletterDistributionTool');

export function createAuditNewsletterDistributionTool(
  auditorService: NewsletterDistributionAuditorService,
): FunctionTool<typeof auditNewsletterDistributionInputSchema> {
  return new FunctionTool({
    name: AUDIT_NEWSLETTER_DISTRIBUTION_TOOL_NAME,
    description:
      'Audits a candidate concert lineup for geographic balance across NC sub-regions (Triangle, Mountains, Coastal, Charlotte) and core genres (Jam, Bluegrass, Funk, Reggae, Alt-Country).',
    parameters: auditNewsletterDistributionInputSchema,
    execute: async ({ events }) => {
      logger.log(
        `[ADK Tool Executed] auditNewsletterDistribution({ eventsCount: ${events.length} })`,
      );
      const report = auditorService.auditDistribution(events);
      return auditNewsletterDistributionOutputSchema.parse({
        totalEvents: report.totalEvents,
        isBalanced: report.isBalanced,
        underrepresentedRegions: report.underrepresentedRegions,
        underrepresentedGenres: report.underrepresentedGenres,
        alerts: report.alerts,
        scoutingRecommendations: report.scoutingRecommendations,
      });
    },
  });
}
