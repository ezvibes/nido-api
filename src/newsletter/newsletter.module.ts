import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { BeehiivService } from './beehiiv.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Concert]), AuthModule],
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterCatalogService, BeehiivService],
  exports: [NewsletterService, NewsletterCatalogService, BeehiivService],
})
export class NewsletterModule {}
