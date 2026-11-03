import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { BeehiivService, BeehiivDraftResponse } from './beehiiv.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { GenerateNewsletterDto } from './dto/generate-newsletter.dto';
import { GenerateNewsletterResponseDto } from './dto/generate-newsletter-response.dto';
import { NewsletterSourcePreviewResponseDto } from './dto/newsletter-source-preview-response.dto';
import { PushBeehiivDraftDto } from './dto/push-beehiiv-draft.dto';
import { AuditDistributionDto } from './dto/audit-distribution.dto';
import { HarvestLineupDto } from './dto/harvest-lineup.dto';
import { NewsletterFeedbackDiffDto } from './dto/newsletter-feedback-diff.dto';
import { SchedulerOrAdminGuard } from '../auth/guards/scheduler-or-admin.guard';

@Controller('api/newsletter')
@ApiTags('Newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletterService: NewsletterService,
    private readonly beehiivService: BeehiivService,
    private readonly auditorService: NewsletterDistributionAuditorService,
    private readonly harvesterService: NewsletterLineupHarvesterService,
    private readonly feedbackService: NewsletterFeedbackLoopService,
  ) {}

  @Post('generate-weekly')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Generate weekly Top Picks newsletter template using Gemini (Admin & Scheduler)',
  })
  @ApiCreatedResponse({
    description: 'The newsletter draft has been successfully generated.',
    type: GenerateNewsletterResponseDto,
  })
  async generateWeekly(
    @Body() dto: GenerateNewsletterDto,
  ): Promise<GenerateNewsletterResponseDto> {
    return this.newsletterService.generateNewsletter(dto);
  }

  @Post('preview-sources')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Preview approved source concerts before generating a newsletter draft (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description:
      'The source concerts and optional parsed calendar events that would be injected into the newsletter prompt.',
    type: NewsletterSourcePreviewResponseDto,
  })
  async previewSources(
    @Body() dto: GenerateNewsletterDto,
  ): Promise<NewsletterSourcePreviewResponseDto> {
    return this.newsletterService.previewNewsletterSources(dto);
  }

  @Post('push-beehiiv-draft')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Push generated HTML newsletter content to Beehiiv API v2 as a template-based draft (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description: 'The draft post details created on Beehiiv.',
  })
  async pushBeehiivDraft(
    @Body() dto: PushBeehiivDraftDto,
  ): Promise<BeehiivDraftResponse> {
    const formattedHtml = this.newsletterService.convertMarkdownToHtml(
      dto.htmlContent,
    );
    return this.beehiivService.createDraftFromHtml({
      title: dto.title,
      htmlContent: formattedHtml,
      postTemplateId: dto.postTemplateId,
      publicationId: dto.publicationId,
    });
  }

  @Post('audit-distribution')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Audit candidate concerts for regional and genre representation balance (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description: 'Regional and genre distribution balance audit report.',
  })
  async auditDistribution(@Body() dto: AuditDistributionDto) {
    return this.auditorService.auditDistribution(dto.events);
  }

  @Post('harvest-lineup')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Harvest supporting acts or festival multi-band rosters for CRM discovery (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description: 'Discovered candidate artists and CRM expansion report.',
  })
  async harvestLineup(@Body() dto: HarvestLineupDto) {
    let artistNames: string[] = [];
    if (dto.sourceType === 'support_act') {
      const parsed = this.harvesterService.extractSupportActs(dto.rawText);
      artistNames = [parsed.headliner, ...parsed.supportingActs];
    } else {
      artistNames = this.harvesterService.parseFestivalLineup(dto.rawText);
    }

    return this.harvesterService.processDiscoveredArtists(
      artistNames,
      dto.sourceType,
      dto.sourceTitle,
      dto.autoCreateInDb,
    );
  }

  @Post('feedback/diff')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run ground-truth diff between original draft and published Beehiiv post (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description: 'Editorial diff report detailing retained, added, and cut shows and voice calibrations.',
  })
  async diffDraftVsPublished(@Body() dto: NewsletterFeedbackDiffDto) {
    const post = await this.beehiivService.getPost(
      dto.postId,
      dto.publicationId,
    );
    const publishedHtml = post.content?.free?.web || '';
    return this.feedbackService.diffDraftVsPublished(
      dto.postId,
      dto.draftContent,
      publishedHtml,
    );
  }

  @Get('feedback/stats/:postId')
  @UseGuards(SchedulerOrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch Beehiiv post engagement metrics and compute artist/venue click affinities (Admin & Scheduler)',
  })
  @ApiOkResponse({
    description: 'Post engagement metrics and entity affinity weights.',
  })
  async getPostFeedbackStats(@Param('postId') postId: string) {
    const stats = await this.beehiivService.getPostStats(postId);
    return this.feedbackService.calculateEngagementAffinities(stats);
  }
}
