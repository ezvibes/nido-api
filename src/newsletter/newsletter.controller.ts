import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { GenerateNewsletterDto } from './dto/generate-newsletter.dto';
import { GenerateNewsletterResponseDto } from './dto/generate-newsletter-response.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';

@Controller('api/newsletter')
@ApiTags('Newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('generate-weekly')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate weekly Top Picks newsletter template using Gemini (Admin only)' })
  @ApiCreatedResponse({
    description: 'The newsletter draft has been successfully generated.',
    type: GenerateNewsletterResponseDto,
  })
  async generateWeekly(
    @Body() dto: GenerateNewsletterDto,
  ): Promise<GenerateNewsletterResponseDto> {
    return this.newsletterService.generateNewsletter(dto);
  }
}
