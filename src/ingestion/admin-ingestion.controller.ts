import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { ReviewConcertUploadDto } from './dto/review-concert-upload.dto';
import {
  AdminConcertUploadListResponseDto,
  AdminConcertUploadResponseDto,
} from './dto/ingestion-response.dto';
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
  @ApiOperation({
    summary: 'List uploaded concert assets for admin review',
    description:
      'Admin-only queue of uploaded concert images and their review status. Use this before deciding whether to approve, reject, or mark an upload as past.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 25, minimum: 1 })
  @ApiQuery({ name: 'offset', required: false, example: 0, minimum: 0 })
  @ApiQuery({
    name: 'reviewStatus',
    required: false,
    enum: ['submitted', 'approved', 'rejected', 'past'],
    example: 'submitted',
  })
  @ApiOkResponse({ type: AdminConcertUploadListResponseDto })
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

  @Put('uploads/:id/review')
  @ApiOperation({
    summary: 'Set review status for an uploaded concert asset',
    description:
      'Admin-only endpoint for marking whether an uploaded flyer should remain submitted, be approved, rejected, or marked as a past event.',
  })
  @ApiParam({
    name: 'id',
    description: 'Concert upload id',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @ApiBody({ type: ReviewConcertUploadDto })
  @ApiOkResponse({ type: AdminConcertUploadResponseDto })
  async reviewUpload(
    @Param('id') id: string,
    @Body() body: ReviewConcertUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionService.adminReviewConcertUpload(id, body, profile.id);
  }
}
