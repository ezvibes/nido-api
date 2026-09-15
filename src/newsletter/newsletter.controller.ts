import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { BeehiivService, BeehiivDraftResponse } from './beehiiv.service';
import { GenerateNewsletterDto } from './dto/generate-newsletter.dto';
import { GenerateNewsletterResponseDto } from './dto/generate-newsletter-response.dto';
import { NewsletterSourcePreviewResponseDto } from './dto/newsletter-source-preview-response.dto';
import { PushBeehiivDraftDto } from './dto/push-beehiiv-draft.dto';
import { SchedulerOrAdminGuard } from '../auth/guards/scheduler-or-admin.guard';

@Controller('api/newsletter')
@ApiTags('Newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletterService: NewsletterService,
    private readonly beehiivService: BeehiivService,
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
    return this.beehiivService.createDraftFromHtml({
      title: dto.title,
      htmlContent: dto.htmlContent,
      postTemplateId: dto.postTemplateId,
      publicationId: dto.publicationId,
    });
  }
}
