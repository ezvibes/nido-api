import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
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
import type { Response } from 'express';
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
import { IngestionPublicationService } from './services/ingestion-publication.service';
import {
  PublishCandidateDto,
  DuplicateDecisionDto,
  RejectCandidateDto,
} from './dto/publication-decision.dto';

@Controller('admin/ingestion')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
@ApiTags('Admin Ingestion')
@ApiBearerAuth()
export class AdminIngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly ingestionPublicationService: IngestionPublicationService,
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
      'Admin-only endpoint for marking whether an uploaded flyer should remain submitted, be approved, rejected, or marked as a past calendar record. When status is approved, concertTitle and concertStartsAt are required and the API publishes or updates a linked concert row in the shared /concerts feed. Example: PUT /admin/ingestion/uploads/87c28620-0a38-4187-89c8-c83a0246e828/review.',
  })
  @ApiParam({
    name: 'id',
    description: 'Concert upload id',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @ApiBody({
    type: ReviewConcertUploadDto,
    examples: {
      approveAndPublish: {
        summary: 'Approve upload and publish a concert',
        value: {
          status: 'approved',
          notes: 'Flyer details confirmed.',
          concertTitle: 'Doctor S at The Pour House',
          concertGenre: 'Live Music',
          concertStartsAt: '2026-07-10T23:00:00.000Z',
          concertVenueName: 'The Pour House',
          concertBandName: 'Doctor S',
          concertDescription: 'Approved flyer upload for the public feed.',
        },
      },
      rejectUpload: {
        summary: 'Reject upload without publishing',
        value: {
          status: 'rejected',
          notes: 'Duplicate or not a concert flyer.',
        },
      },
    },
  })
  @ApiOkResponse({ type: AdminConcertUploadResponseDto })
  async reviewUpload(
    @Param('id') id: string,
    @Body() body: ReviewConcertUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionService.adminReviewConcertUpload(id, body, profile.id);
  }

  @Get('uploads/:id/image')
  @ApiOperation({
    summary: 'Stream an uploaded concert image for admin preview',
    description:
      'Admin-only endpoint that streams the original uploaded image from GCS for review.',
  })
  @ApiParam({
    name: 'id',
    description: 'Concert upload id',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  async streamUploadImage(@Param('id') id: string, @Res() res: Response) {
    return this.ingestionService.adminStreamUploadImage(id, res);
  }

  @Get('candidates')
  @ApiOperation({
    summary: 'List extracted show candidates for admin review',
    description: 'Admin queue of extracted concert candidates with priority and provenance.',
  })
  @ApiQuery({ name: 'status', required: false, example: 'pending' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  async listCandidates(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    return this.ingestionPublicationService.listCandidates({
      status,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    });
  }

  @Get('candidates/:id')
  @ApiOperation({
    summary: 'Get details for a single candidate including probable duplicate concerts',
  })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async getCandidate(@Param('id') id: string) {
    return this.ingestionPublicationService.getCandidate(id);
  }

  @Post('candidates/:id/publish')
  @ApiOperation({
    summary: 'Approve and publish an extracted show candidate to the canonical concert catalog',
  })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async publishCandidate(
    @Param('id') id: string,
    @Body() body: PublishCandidateDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionPublicationService.publishCandidate(id, body, profile.id);
  }

  @Post('candidates/:id/duplicate-decision')
  @ApiOperation({
    summary: 'Resolve a probable duplicate decision (link, merge, publish_separately, or reject)',
  })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async handleDuplicateDecision(
    @Param('id') id: string,
    @Body() body: DuplicateDecisionDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionPublicationService.handleDuplicateDecision(id, body, profile.id);
  }

  @Post('candidates/:id/reject')
  @ApiOperation({
    summary: 'Reject an extracted show candidate',
  })
  @ApiParam({ name: 'id', description: 'Candidate UUID' })
  async rejectCandidate(
    @Param('id') id: string,
    @Body() body: RejectCandidateDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.ingestionPublicationService.rejectCandidate(id, body.reason, profile.id);
  }
}
