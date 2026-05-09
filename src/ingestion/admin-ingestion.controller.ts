import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { ReviewConcertUploadDto } from './dto/review-concert-upload.dto';
import { IngestionService } from './ingestion.service';

@Controller('admin/ingestion')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
export class AdminIngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly userService: UserService,
  ) {}

  @Get('uploads')
  async listUploads(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('reviewStatus') reviewStatus?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;

    return this.ingestionService.adminListConcertUploads({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      reviewStatus,
    });
  }

  @Get('uploads/:id/image')
  async streamUploadImage(@Param('id') id: string, @Res() res: Response) {
    await this.ingestionService.adminStreamUploadImage(id, res);
  }

  @Put('uploads/:id/review')
  async reviewUpload(
    @Param('id') id: string,
    @Body() body: ReviewConcertUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionService.adminReviewConcertUpload(id, body, profile.id);
  }
}
