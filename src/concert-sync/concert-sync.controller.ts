import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { ConcertSyncScheduleService } from './concert-sync-schedule.service';
import { ConcertSyncService } from './concert-sync.service';
import { CreateConcertSyncJobDto } from './dto/create-concert-sync-job.dto';
import { CreateConcertSyncScheduleDto } from './dto/create-concert-sync-schedule.dto';
import { ListConcertSyncJobsDto } from './dto/list-concert-sync-jobs.dto';
import { ListConcertSyncSchedulesDto } from './dto/list-concert-sync-schedules.dto';
import { PromptPreviewDto } from './dto/prompt-preview.dto';
import { RefreshTopPicksDto } from './dto/refresh-top-picks.dto';
import { UpdateConcertSyncScheduleDto } from './dto/update-concert-sync-schedule.dto';

@Controller('concert-sync')
@UseGuards(FirebaseAuthGuard)
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
  async createJob(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertSyncJobDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.createJobForOwner(owner, body);
  }

  @Get('jobs')
  async listJobs(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertSyncJobsDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.listJobsForOwner(owner, query);
  }

  @Get('gemini/prompt-template')
  getPromptTemplate() {
    return this.concertSyncService.getGeminiPromptTemplate();
  }

  @Post('gemini/prompt-preview')
  previewPrompt(@Body() body: PromptPreviewDto) {
    return this.concertSyncService.previewGeminiPrompt({
      event: body.event,
      geminiPrompt: body.geminiPrompt,
      geminiContext: body.geminiContext,
    });
  }

  @Get('jobs/:id')
  async getJob(@CurrentUser() user: DecodedIdToken, @Param('id') id: string) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.getJobForOwner(id, owner);
  }

  @Post('top-picks/refresh')
  async refreshTopPicks(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: RefreshTopPicksDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncService.refreshTopPicksForOwner(owner, body);
  }

  @Get('top-picks')
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
  async createSchedule(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertSyncScheduleDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.createScheduleForOwner(owner, body);
  }

  @Get('schedules')
  async listSchedules(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertSyncSchedulesDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.listSchedulesForOwner(owner, query);
  }

  @Get('schedules/:id')
  async getSchedule(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.getScheduleForOwner(id, owner);
  }

  @Post('schedules/:id/run')
  async runScheduleNow(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertSyncScheduleService.runScheduleNowForOwner(id, owner);
  }

  @Post('schedules/:id/update')
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
