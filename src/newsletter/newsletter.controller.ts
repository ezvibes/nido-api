import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  extractClientIp,
  SlidingWindowIpRateLimiter,
} from '../common/rate-limit/ip-rate-limiter';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { BeehiivService, BeehiivDraftResponse } from './beehiiv.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { WeeklyContentBriefService } from './weekly-content-brief.service';
import { SocialConceptGeneratorService } from './social-concept-generator.service';
import { GenerateNewsletterDto } from './dto/generate-newsletter.dto';
import { GenerateNewsletterResponseDto } from './dto/generate-newsletter-response.dto';
import { NewsletterSourcePreviewResponseDto } from './dto/newsletter-source-preview-response.dto';
import { PushBeehiivDraftDto } from './dto/push-beehiiv-draft.dto';
import { AuditDistributionDto } from './dto/audit-distribution.dto';
import { HarvestLineupDto } from './dto/harvest-lineup.dto';
import { NewsletterFeedbackDiffDto } from './dto/newsletter-feedback-diff.dto';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { SchedulerOrAdminGuard } from '../auth/guards/scheduler-or-admin.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import {
  WeeklyContentBriefSchema,
  type WeeklyContentBrief,
} from '../contracts/content-brief.contract';
import type { WeeklySocialConceptsBatch } from '../contracts/social-concept.contract';

const SUBSCRIBE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS = 5;

@Controller(['api/newsletter', 'newsletter'])
@ApiTags('Newsletter')
export class NewsletterController {
  private readonly subscribeRateLimiter = new SlidingWindowIpRateLimiter({
    windowMs: SUBSCRIBE_RATE_LIMIT_WINDOW_MS,
    maxAttempts: SUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS,
    message: 'Too many subscription attempts. Please try again later.',
  });

  constructor(
    private readonly newsletterService: NewsletterService,
    private readonly beehiivService: BeehiivService,
    private readonly auditorService: NewsletterDistributionAuditorService,
    private readonly harvesterService: NewsletterLineupHarvesterService,
    private readonly feedbackService: NewsletterFeedbackLoopService,
    private readonly weeklyContentBriefService: WeeklyContentBriefService,
    private readonly socialConceptGeneratorService: SocialConceptGeneratorService,
  ) {}

  @Get('weekly-brief')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate a structured weekly content brief from active, admin-approved upcoming concerts (Admin only)',
  })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'campaignTheme', required: false, type: String })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'markdown'],
  })
  @ApiOkResponse({
    description:
      'Weekly content brief in JSON or Markdown format for Muse and editorial review.',
  })
  async getWeeklyBrief(
    @Query('daysAhead') daysAheadRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('campaignTheme') campaignTheme?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<WeeklyContentBrief | string> {
    const daysAhead = this.parseOptionalInt(daysAheadRaw, 'daysAhead');
    const limit = this.parseOptionalInt(limitRaw, 'limit');
    const normalizedFormat = (format ?? 'json').trim().toLowerCase();

    if (normalizedFormat !== 'json' && normalizedFormat !== 'markdown') {
      throw new BadRequestException(
        'format must be either "json" or "markdown".',
      );
    }

    const brief = await this.weeklyContentBriefService.generateBrief({
      daysAhead,
      limit,
      campaignTheme,
    });

    if (normalizedFormat === 'markdown') {
      res?.type('text/markdown; charset=utf-8');
      return this.weeklyContentBriefService.formatAsMarkdown(brief);
    }

    return brief;
  }

  @Get('social-concepts')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate 3 weekly social concepts grounded in the weekly content brief (Admin only)',
  })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'campaignTheme', required: false, type: String })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'markdown'],
  })
  @ApiOkResponse({
    description:
      'Weekly social concepts batch in JSON or Markdown format for Muse handoff.',
  })
  async getSocialConcepts(
    @Query('daysAhead') daysAheadRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('campaignTheme') campaignTheme?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<WeeklySocialConceptsBatch | string> {
    const daysAhead = this.parseOptionalInt(daysAheadRaw, 'daysAhead');
    const limit = this.parseOptionalInt(limitRaw, 'limit');
    const normalizedFormat = (format ?? 'json').trim().toLowerCase();

    if (normalizedFormat !== 'json' && normalizedFormat !== 'markdown') {
      throw new BadRequestException(
        'format must be either "json" or "markdown".',
      );
    }

    const batch =
      await this.socialConceptGeneratorService.generateWeeklyConcepts({
        daysAhead,
        limit,
        campaignTheme,
      });

    if (normalizedFormat === 'markdown') {
      res?.type('text/markdown; charset=utf-8');
      return this.socialConceptGeneratorService.formatAsMarkdown(batch);
    }

    return batch;
  }

  @Post('social-concepts/from-brief')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Generate 3 weekly social concepts from a provided WeeklyContentBrief payload (Admin only)',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'markdown'],
  })
  @ApiOkResponse({
    description:
      'Weekly social concepts batch generated strictly from the supplied brief.',
  })
  generateSocialConceptsFromBrief(
    @Body() body: unknown,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): WeeklySocialConceptsBatch | string {
    const normalizedFormat = (format ?? 'json').trim().toLowerCase();
    if (normalizedFormat !== 'json' && normalizedFormat !== 'markdown') {
      throw new BadRequestException(
        'format must be either "json" or "markdown".',
      );
    }

    const parsed = WeeklyContentBriefSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid WeeklyContentBrief payload: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }

    const batch = this.socialConceptGeneratorService.generateFromBrief(
      parsed.data,
    );

    if (normalizedFormat === 'markdown') {
      res?.type('text/markdown; charset=utf-8');
      return this.socialConceptGeneratorService.formatAsMarkdown(batch);
    }

    return batch;
  }

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
    description:
      'Editorial diff report detailing retained, added, and cut shows and voice calibrations.',
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

  @Post('subscribe')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Publicly subscribe an email address to the EZ Vibes Weekly Top Picks newsletter',
  })
  @ApiOkResponse({
    description: 'Subscription confirmation status.',
  })
  async subscribe(@Body() dto: SubscribeNewsletterDto, @Req() req?: Request) {
    if (dto.website && dto.website.trim().length > 0) {
      throw new BadRequestException('Invalid subscription request.');
    }

    const clientIp = extractClientIp(req);
    this.subscribeRateLimiter.enforce(clientIp);

    return this.beehiivService.subscribeEmail(dto);
  }

  resetSubscribeRateLimits(): void {
    this.subscribeRateLimiter.reset();
  }

  private parseOptionalInt(
    raw: string | undefined,
    fieldName: string,
  ): number | undefined {
    if (raw === undefined || raw.trim() === '') {
      return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`${fieldName} must be an integer.`);
    }
    return parsed;
  }
}
