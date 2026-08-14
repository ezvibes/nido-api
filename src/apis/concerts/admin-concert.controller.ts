import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../users/user.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { ConcertService } from './concert.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { UploadableFile } from '../../ingestion/interfaces/uploadable-file.interface';
import { SetConcertApprovalDto } from './dto/set-concert-approval.dto';
import {
  AdminConcertListResponseDto,
  AdminConcertResponseDto,
} from './dto/concert-response.dto';
import { ListAdminConcertsDto } from './dto/list-admin-concerts.dto';
import { UpdateAdminConcertDto } from './dto/update-admin-concert.dto';

@Controller('admin/concerts')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
@ApiTags('Admin Concerts')
@ApiBearerAuth()
export class AdminConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List concerts for catalog administration',
    description:
      'Returns a paginated, searchable catalog to authenticated admins. Includes active, hidden, and archived records and defaults to all catalog states.',
  })
  @ApiOkResponse({ type: AdminConcertListResponseDto })
  async list(@Query() query: ListAdminConcertsDto) {
    return this.concertService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a concert for catalog administration' })
  @ApiParam({ name: 'id', description: 'Concert id' })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  @ApiNotFoundResponse({ description: 'Concert not found.' })
  async get(@Param('id') id: string) {
    return this.concertService.findOneAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit concert content and editorial catalog state',
    description:
      'Applies the supported content, venue, visibility, Featured, and sync-authority fields as one authoritative admin operation. Uses expectedVersion for lock-free optimistic concurrency. A stale request returns 409 and never overwrites the newer record. Editing source-managed content pauses calendar overwrites until explicitly resumed.',
  })
  @ApiParam({ name: 'id', description: 'Concert id' })
  @ApiBody({ type: UpdateAdminConcertDto })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  @ApiBadRequestResponse({
    description:
      'The request contains invalid fields, exceeds storage limits, or attempts to Feature a non-active concert.',
  })
  @ApiNotFoundResponse({ description: 'Concert not found.' })
  @ApiConflictResponse({
    description:
      'The concert changed after the admin loaded it. Reload the current version before retrying.',
  })
  async update(@Param('id') id: string, @Body() body: UpdateAdminConcertDto) {
    return this.concertService.updateAdmin(id, body);
  }

  @Put(':id/approval')
  @ApiOperation({
    summary: 'Approve or unapprove a concert for Top Picks eligibility',
    description:
      'Admin-only endpoint. Approved concerts can participate in internal Top Picks scoring after sync jobs refresh rankings.',
  })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiBody({ type: SetConcertApprovalDto })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  async setApproval(
    @Param('id') id: string,
    @Body() body: SetConcertApprovalDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const reviewer = await this.userService.syncFromToken(user);
    return this.concertService.setAdminApproval(id, reviewer, body.approved);
  }

  @Post(':id/poster')
  @ApiOperation({
    summary: 'Upload and attach a poster/flyer image to an existing concert',
    description:
      'Uploads an image file to GCS, marks it approved, and links it directly to this concert.',
  })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 50 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadPoster(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      file?: UploadableFile[];
      image?: UploadableFile[];
    },
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    const file = files?.file?.[0] ?? files?.image?.[0];
    return this.ingestionService.attachPosterToConcert(id, file, user.uid, profile.id);
  }
}

