import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import {
  InstagramConnectionStatus,
  InstagramInsights,
  InstagramMediaItem,
} from '../contracts/instagram.contract';
import {
  InstagramAuthService,
  InstagramAuthorizeResult,
} from './instagram-auth.service';
import { InstagramMediaService } from './instagram-media.service';

@Controller('admin/instagram')
@ApiTags('Admin Instagram')
export class AdminInstagramController {
  constructor(
    private readonly instagramAuthService: InstagramAuthService,
    private readonly instagramMediaService: InstagramMediaService,
  ) {}

  @Get('status')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get sanitized Instagram Business connection status (Admin only)',
  })
  async getStatus(): Promise<InstagramConnectionStatus> {
    return this.instagramAuthService.getStatus();
  }

  @Get('oauth/start')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate Instagram Business Login OAuth URL with signed CSRF state (Admin only)',
  })
  startOAuth(@CurrentUser() user?: DecodedIdToken): InstagramAuthorizeResult {
    return this.instagramAuthService.buildAuthorizeUrl(user?.email);
  }

  @Get('oauth/callback')
  @ApiOperation({
    summary:
      'Handle Meta OAuth browser redirect callback (authenticated via signed CSRF state) and persist encrypted long-lived token',
  })
  @ApiQuery({ name: 'code', required: true, type: String })
  @ApiQuery({ name: 'state', required: true, type: String })
  async oauthCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<InstagramConnectionStatus> {
    if (!code || !state) {
      throw new BadRequestException(
        'Both code and state query parameters are required.',
      );
    }
    return this.instagramAuthService.handleOAuthCallback(code, state);
  }

  @Post('disconnect')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Disconnect Instagram Business account, clear token ciphertext, and mark revoked (Admin only)',
  })
  async disconnect(): Promise<InstagramConnectionStatus> {
    return this.instagramAuthService.disconnect();
  }

  @Get('media')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List own Instagram Business media items, bounded to limit <= 25 (Admin only)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listMedia(
    @Query('limit') limit?: string,
  ): Promise<InstagramMediaItem[]> {
    const parsedLimit = limit !== undefined ? Number(limit) : 10;
    return this.instagramMediaService.listOwnMedia(parsedLimit);
  }

  @Get('media/:id/insights')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Fetch read-only insights for an Instagram media item (Admin only)',
  })
  async getMediaInsights(@Param('id') id: string): Promise<InstagramInsights> {
    return this.instagramMediaService.getMediaInsights(id);
  }
}
