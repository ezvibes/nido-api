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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { ConcertSyncScheduleService } from './concert-sync-schedule.service';
import { ConcertSyncService } from './concert-sync.service';
import { CreateConcertSyncJobDto } from './dto/create-concert-sync-job.dto';
import { CreateConcertSyncScheduleDto } from './dto/create-concert-sync-schedule.dto';
import {
  ListConcertSyncJobsDto,
  syncJobStatuses,
} from './dto/list-concert-sync-jobs.dto';
import { ListConcertSyncSchedulesDto } from './dto/list-concert-sync-schedules.dto';
import { PromptPreviewDto } from './dto/prompt-preview.dto';
import { RefreshTopPicksDto } from './dto/refresh-top-picks.dto';
import {
  scheduleStatuses,
  UpdateConcertSyncScheduleDto,
} from './dto/update-concert-sync-schedule.dto';

@Controller('concert-sync')
@UseGuards(FirebaseAuthGuard)
@ApiTags('Doctor S Calendar Sync')
@ApiBearerAuth()
export class ConcertSyncController {
  constructor(
    private readonly concertSyncService: ConcertSyncService,
    private readonly concertSyncScheduleService: ConcertSyncScheduleService,
    private readonly userService: UserService,
  ) {}

  private async ensureOwner(decodedToken: DecodedIdToken) {
    return this.userService.syncFromToken(decodedToken);
  }

  @Post('jobs')
  @ApiOperation({
    summary: 'Create a Doctor S calendar sync job',
    description:
      'Starts an async sync job from Google Calendar or sampleEvents. Use sampleEvents for local QA without Google credentials.',
  })
  @ApiBody({ type: CreateConcertSyncJobDto })
  async createJob(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertSyncJobDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.createJobForOwner(owner, body);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List Doctor S sync jobs for the current user' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: syncJobStatuses,
    example: 'completed',
  })
  async listJobs(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertSyncJobsDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.listJobsForOwner(owner, query);
  }

  @Get('gemini/prompt-template')
  @ApiOperation({
    summary: 'Inspect the active Gemini prompt template and extraction policy',
  })
  getPromptTemplate() {
    return this.concertSyncService.getGeminiPromptTemplate();
  }

  @Post('gemini/prompt-preview')
  @ApiOperation({
    summary: 'Preview the exact Gemini prompt and sanitized event payload',
  })
  @ApiBody({ type: PromptPreviewDto })
  previewPrompt(@Body() body: PromptPreviewDto) {
    return this.concertSyncService.previewGeminiPrompt({
      event: body.event,
      geminiPrompt: body.geminiPrompt,
      geminiContext: body.geminiContext,
    });
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a sync job and recent event mappings' })
  @ApiParam({ name: 'id', description: 'Concert sync job id' })
  async getJob(@CurrentUser() user: DecodedIdToken, @Param('id') id: string) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.getJobForOwner(id, owner);
  }

  @Post('top-picks/refresh')
  @ApiOperation({
    summary: 'Refresh Top Picks for admin-approved concerts only',
  })
  @ApiBody({ type: RefreshTopPicksDto })
  async refreshTopPicks(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: RefreshTopPicksDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.refreshTopPicksForOwner(owner, body);
  }

  @Get('top-picks')
  @ApiOperation({ summary: 'List current Top Picks for the current user' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async listTopPicks(
    @CurrentUser() user: DecodedIdToken,
    @Query('limit') limit?: string,
  ) {
    const owner = await this.ensureOwner(user);
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.concertSyncService.listTopPicksForOwner(
      owner,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @Post('schedules')
  @ApiOperation({
    summary: 'Create an autonomous Doctor S calendar sync schedule',
    description:
      'Stores the Google refresh token encrypted at rest and runs recurring calendar syncs.',
  })
  @ApiBody({ type: CreateConcertSyncScheduleDto })
  async createSchedule(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertSyncScheduleDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.createScheduleForOwner(owner, body);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List autonomous sync schedules' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: scheduleStatuses,
    example: 'active',
  })
  async listSchedules(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertSyncSchedulesDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.listSchedulesForOwner(owner, query);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get an autonomous sync schedule' })
  @ApiParam({ name: 'id', description: 'Concert sync schedule id' })
  async getSchedule(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.getScheduleForOwner(id, owner);
  }

  @Post('schedules/:id/run')
  @ApiOperation({ summary: 'Trigger a schedule immediately' })
  @ApiParam({ name: 'id', description: 'Concert sync schedule id' })
  async runScheduleNow(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.runScheduleNowForOwner(id, owner);
  }

  @Post('schedules/:id/update')
  @ApiOperation({ summary: 'Update cadence, status, prompt context, or token' })
  @ApiParam({ name: 'id', description: 'Concert sync schedule id' })
  @ApiBody({ type: UpdateConcertSyncScheduleDto })
  async updateSchedule(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
    @Body() body: UpdateConcertSyncScheduleDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.updateScheduleForOwner(
      id,
      owner,
      body,
    );
  }
}
