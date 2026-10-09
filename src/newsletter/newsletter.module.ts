import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { ConcertBandLineup } from '../apis/concerts/entities/concert-band-lineup.entity';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { BeehiivService } from './beehiiv.service';
import { AuthModule } from '../auth/auth.module';
import { NewsletterAgentToolRegistry } from './agent/newsletter-agent-tool-registry.service';
import { TicketUrlVerificationService } from './ticket-url-verification.service';
import { NewsletterCoBillService } from './newsletter-co-bill.service';

@Module({
  imports: [TypeOrmModule.forFeature([Concert, ConcertBandLineup]), AuthModule],
  controllers: [NewsletterController],
  providers: [
    NewsletterService,
    NewsletterCatalogService,
    NewsletterCoBillService,
    NewsletterAgentToolRegistry,
    BeehiivService,
    TicketUrlVerificationService,
  ],
  exports: [
    NewsletterService,
    NewsletterCatalogService,
    NewsletterCoBillService,
    NewsletterAgentToolRegistry,
    BeehiivService,
    TicketUrlVerificationService,
  ],
})
export class NewsletterModule {}
