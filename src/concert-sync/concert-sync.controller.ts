import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { ConcertSyncService } from './concert-sync.service';
import { CreateConcertSyncJobDto } from './dto/create-concert-sync-job.dto';
import {
  ListConcertSyncJobsDto,
  syncJobStatuses,
} from './dto/list-concert-sync-jobs.dto';
import {
  ConcertSyncJobDetailResponseDto,
  ConcertSyncJobListResponseDto,
  ConcertSyncJobResponseDto,
} from './dto/concert-sync-job-response.dto';

@Controller('concert-sync')
@UseGuards(FirebaseAuthGuard)
@ApiTags('Doctor S Calendar Sync')
@ApiBearerAuth()
export class ConcertSyncController {
  constructor(
    private readonly concertSyncService: ConcertSyncService,
    private readonly userService: UserService,
  ) {}

  private async ensureOwner(decodedToken: DecodedIdToken) {
    return this.userService.syncFromToken(decodedToken);
  }

  @Post('jobs')
  @ApiOperation({
    summary: 'Create a Doctor S calendar sync job',
    description:
      'Starts an async job that turns Google Calendar-style events into concert records. Use dryRun=true to preview sanitized prompts without Gemini calls or database writes.',
  })
  @ApiBody({
    type: CreateConcertSyncJobDto,
    examples: {
      dryRun: {
        summary: 'No-cost dry run with one sample event',
        value: {
          dryRun: true,
          maxEvents: 1,
          refreshTopPicks: false,
          sampleEvents: [
            {
              id: 'qa-evt-1',
              status: 'confirmed',
              summary: 'Doctor S Presents: Neon Tide with DJ Luna',
              description:
                'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
              location: 'The Evening Muse, Charlotte, NC',
              start: {
                dateTime: '2026-06-15T21:00:00-04:00',
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: '2026-06-15T23:30:00-04:00',
                timeZone: 'America/New_York',
              },
            },
          ],
        },
      },
      sampleSync: {
        summary: 'Create concerts from sample events',
        value: {
          calendarId: 'primary',
          fromDate: '2026-06-01T00:00:00.000Z',
          toDate: '2026-07-01T00:00:00.000Z',
          maxEvents: 1,
          refreshTopPicks: true,
          geminiContext:
            'Doctor S focuses on high-signal live music listings in Charlotte and nearby NC markets.',
          sampleEvents: [
            {
              id: 'qa-evt-2',
              status: 'confirmed',
              summary: 'Doctor S Presents: Velvet Circuit Live',
              description:
                'Live synth funk concert with opener Solar Keys. Doors 7:30 PM, show 8:30 PM.',
              location: 'Neighborhood Theatre, Charlotte, NC',
              start: {
                dateTime: '2026-06-22T20:30:00-04:00',
                timeZone: 'America/New_York',
              },
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ConcertSyncJobResponseDto })
  async createJob(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertSyncJobDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.createJobForOwner(owner, body);
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'List Doctor S sync jobs for the current user',
    description:
      'Use this endpoint to inspect recent queued, processing, completed, or failed sync attempts.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'offset', required: false, example: 0, minimum: 0 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: syncJobStatuses,
    example: 'completed',
  })
  @ApiOkResponse({ type: ConcertSyncJobListResponseDto })
  async listJobs(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertSyncJobsDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.listJobsForOwner(owner, query);
  }

  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Get a sync job and recent event mappings',
    description:
      'Returns job counters, metadata such as fallback reasons, dry-run prompt previews, and recent calendar-event-to-concert mappings.',
  })
  @ApiParam({
    name: 'id',
    description: 'Concert sync job id',
    example: '0f0aaf91-1f31-4f0f-91f9-006a10b2ee81',
  })
  @ApiOkResponse({ type: ConcertSyncJobDetailResponseDto })
  async getJob(@CurrentUser() user: DecodedIdToken, @Param('id') id: string) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.getJobForOwner(id, owner);
  }
}
