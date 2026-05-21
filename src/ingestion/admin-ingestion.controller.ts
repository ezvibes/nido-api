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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('Admin Ingestion')
@ApiBearerAuth()
export class AdminIngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly userService: UserService,
  ) {}

  @Get('uploads')
  @ApiOperation({ summary: 'List uploaded concert assets for admin review' })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'reviewStatus', required: false, example: 'submitted' })
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
  @ApiOperation({ summary: 'Stream an uploaded concert image for review' })
  @ApiParam({ name: 'id', description: 'Concert upload id' })
  async streamUploadImage(@Param('id') id: string, @Res() res: Response) {
    await this.ingestionService.adminStreamUploadImage(id, res);
  }

  @Put('uploads/:id/review')
  @ApiOperation({ summary: 'Set review status for an uploaded concert asset' })
  @ApiParam({ name: 'id', description: 'Concert upload id' })
  @ApiBody({ type: ReviewConcertUploadDto })
  async reviewUpload(
    @Param('id') id: string,
    @Body() body: ReviewConcertUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionService.adminReviewConcertUpload(id, body, profile.id);
  }
}
