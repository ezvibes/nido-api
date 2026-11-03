import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { ConcertBandLineup } from '../apis/concerts/entities/concert-band-lineup.entity';
import { Band } from '../apis/bands/entities/band.entity';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { BeehiivService } from './beehiiv.service';
import { BeehiivMcpService } from './beehiiv-mcp.service';
import { AuthModule } from '../auth/auth.module';
import { NewsletterAgentToolRegistry } from './agent/newsletter-agent-tool-registry.service';
import { TicketUrlVerificationService } from './ticket-url-verification.service';
import { NewsletterCoBillService } from './newsletter-co-bill.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { AgentSession } from '../apis/agents/entities/agent-session.entity';
import { TypeOrmSessionService } from '../apis/agents/session/typeorm-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, ConcertBandLineup, AgentSession, Band]),
    AuthModule,
  ],
  controllers: [NewsletterController],
  providers: [
    NewsletterService,
    NewsletterCatalogService,
    NewsletterCoBillService,
    NewsletterAgentToolRegistry,
    BeehiivService,
    BeehiivMcpService,
    TicketUrlVerificationService,
    NewsletterDistributionAuditorService,
    NewsletterLineupHarvesterService,
    NewsletterFeedbackLoopService,
    TypeOrmSessionService,
  ],
  exports: [
    NewsletterService,
    NewsletterCatalogService,
    NewsletterCoBillService,
    NewsletterAgentToolRegistry,
    BeehiivService,
    BeehiivMcpService,
    TicketUrlVerificationService,
    NewsletterDistributionAuditorService,
    NewsletterLineupHarvesterService,
    NewsletterFeedbackLoopService,
    TypeOrmSessionService,
  ],
})
export class NewsletterModule {}
