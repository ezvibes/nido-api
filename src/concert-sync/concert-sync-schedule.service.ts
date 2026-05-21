import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../apis/users/entities/user.entity';
import { ConcertSyncService } from './concert-sync.service';
import { CreateConcertSyncScheduleDto } from './dto/create-concert-sync-schedule.dto';
import { ListConcertSyncSchedulesDto } from './dto/list-concert-sync-schedules.dto';
import { UpdateConcertSyncScheduleDto } from './dto/update-concert-sync-schedule.dto';
import { ConcertSyncSchedule } from './entities/concert-sync-schedule.entity';
import { GoogleOAuthTokenService } from './services/google-oauth-token.service';
import { TokenProtectionService } from './services/token-protection.service';

@Injectable()
export class ConcertSyncScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConcertSyncScheduleService.name);
  private readonly runLockTimeoutMs = 30 * 60 * 1000;
  private timer?: NodeJS.Timeout;
  private tickInFlight = false;

  constructor(
    @InjectRepository(ConcertSyncSchedule)
    private readonly scheduleRepository: Repository<ConcertSyncSchedule>,
    private readonly concertSyncService: ConcertSyncService,
    private readonly tokenProtectionService: TokenProtectionService,
    private readonly googleOAuthTokenService: GoogleOAuthTokenService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<string>('CONCERT_SYNC_SCHEDULER_ENABLED');
    if (enabled?.trim().toLowerCase() === 'false') {
      return;
    }

    const pollMs = this.getPollIntervalMs();
    this.timer = setInterval(() => {
      void this.pollDueSchedules();
    }, pollMs);

    void this.pollDueSchedules();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async createScheduleForOwner(owner: User, dto: CreateConcertSyncScheduleDto) {
    const schedule = this.scheduleRepository.create({
      owner,
      calendarId: dto.calendarId?.trim() || 'primary',
      status: 'active',
      cadenceMinutes: dto.cadenceMinutes ?? 60,
      lookaheadDays: dto.lookaheadDays ?? 30,
      refreshTopPicks: dto.refreshTopPicks ?? true,
      encryptedRefreshToken: this.tokenProtectionService.encrypt(
        dto.googleRefreshToken.trim(),
      ),
      geminiPrompt: dto.geminiPrompt?.trim() || null,
      geminiContext: dto.geminiContext?.trim() || null,
      nextRunAt: dto.runImmediately === false ? this.computeNextRunAt(dto.cadenceMinutes ?? 60) : new Date(),
      scheduleMetadata: {},
    });

    const saved = await this.scheduleRepository.save(schedule);

    if (dto.runImmediately !== false) {
      void this.executeSchedule(saved.id);
    }

    return this.formatSchedule(saved);
  }

  async listSchedulesForOwner(owner: User, query: ListConcertSyncSchedulesDto) {
    const qb = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.lastJob', 'lastJob')
      .where('schedule.owner_id = :ownerId', { ownerId: owner.id })
      .orderBy('schedule.createdAt', 'DESC')
      .take(query.limit)
      .skip(query.offset);

    if (query.status) {
      qb.andWhere('schedule.status = :status', { status: query.status });
    }

    const [schedules, total] = await qb.getManyAndCount();

    return {
      total,
      items: schedules.map((schedule) => this.formatSchedule(schedule)),
    };
  }

  async getScheduleForOwner(id: string, owner: User) {
    const schedule = await this.findOwnerSchedule(id, owner.id);
    return this.formatSchedule(schedule);
  }

  async updateScheduleForOwner(
    id: string,
    owner: User,
    dto: UpdateConcertSyncScheduleDto,
  ) {
    const schedule = await this.findOwnerSchedule(id, owner.id);

    if (dto.cadenceMinutes !== undefined) {
      schedule.cadenceMinutes = dto.cadenceMinutes;
    }

    if (dto.lookaheadDays !== undefined) {
      schedule.lookaheadDays = dto.lookaheadDays;
    }

    if (dto.refreshTopPicks !== undefined) {
      schedule.refreshTopPicks = dto.refreshTopPicks;
    }

    if (dto.geminiPrompt !== undefined) {
      schedule.geminiPrompt = dto.geminiPrompt?.trim() || null;
    }

    if (dto.geminiContext !== undefined) {
      schedule.geminiContext = dto.geminiContext?.trim() || null;
    }

    if (dto.googleRefreshToken !== undefined) {
      schedule.encryptedRefreshToken = this.tokenProtectionService.encrypt(
        dto.googleRefreshToken.trim(),
      );
    }

    if (dto.status) {
      schedule.status = dto.status;
      if (dto.status === 'active' && schedule.nextRunAt <= new Date()) {
        schedule.nextRunAt = new Date();
      }
    }

    const saved = await this.scheduleRepository.save(schedule);
    return this.formatSchedule(saved);
  }

  async runScheduleNowForOwner(id: string, owner: User) {
    const schedule = await this.findOwnerSchedule(id, owner.id);
    if (schedule.status !== 'active') {
      throw new BadRequestException('Schedule must be active to run immediately.');
    }
    if (this.isRunLocked(schedule)) {
      throw new BadRequestException('Schedule is already running.');
    }

    const updated = await this.scheduleRepository.save({
      ...schedule,
      nextRunAt: new Date(),
    });

    void this.executeSchedule(updated.id);

    return this.formatSchedule(updated);
  }

  private async pollDueSchedules() {
    if (this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;
    try {
      const now = new Date();
      const dueSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.owner', 'owner')
        .where('schedule.status = :status', { status: 'active' })
        .andWhere('schedule.next_run_at <= :now', { now: now.toISOString() })
        .orderBy('schedule.nextRunAt', 'ASC')
        .take(20)
        .getMany();

      for (const schedule of dueSchedules) {
        await this.executeSchedule(schedule.id);
      }
    } catch (error) {
      this.logger.error(
        `Scheduler poll failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.tickInFlight = false;
    }
  }

  private async executeSchedule(scheduleId: string) {
    const now = new Date();
    const schedule = await this.claimScheduleForExecution(scheduleId, now);
    if (!schedule) {
      return;
    }

    const nextRunAt = this.computeNextRunAt(schedule.cadenceMinutes, now);

    try {
      const refreshToken = this.tokenProtectionService.decrypt(
        schedule.encryptedRefreshToken,
      );
      const accessToken = await this.googleOAuthTokenService.exchangeRefreshToken(
        refreshToken,
      );

      const fromDate = now.toISOString();
      const toDate = new Date(
        now.getTime() + schedule.lookaheadDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const createdJob = await this.concertSyncService.createJobForOwner(
        schedule.owner,
        {
          calendarId: schedule.calendarId,
          googleAccessToken: accessToken,
          fromDate,
          toDate,
          refreshTopPicks: schedule.refreshTopPicks,
          geminiPrompt: schedule.geminiPrompt || undefined,
          geminiContext: schedule.geminiContext || undefined,
        },
      );

      schedule.lastRunAt = now;
      schedule.runStartedAt = null;
      schedule.nextRunAt = nextRunAt;
      schedule.lastError = null;
      schedule.scheduleMetadata = {
        ...(schedule.scheduleMetadata || {}),
        lastTriggeredAt: now.toISOString(),
      };

      schedule.lastJobId = createdJob.id;

      await this.scheduleRepository.save(schedule);
    } catch (error) {
      schedule.lastRunAt = now;
      schedule.runStartedAt = null;
      schedule.nextRunAt = nextRunAt;
      schedule.lastError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Unknown schedule execution error';
      await this.scheduleRepository.save(schedule);
    }
  }

  private async claimScheduleForExecution(scheduleId: string, now: Date) {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: { owner: true, lastJob: true },
    });

    if (
      !schedule ||
      schedule.status !== 'active' ||
      schedule.nextRunAt > now ||
      this.isRunLocked(schedule, now)
    ) {
      return null;
    }

    const previousNextRunAt = schedule.nextRunAt;
    const claimedNextRunAt = this.computeNextRunAt(schedule.cadenceMinutes, now);
    const claimQb = this.scheduleRepository
      .createQueryBuilder()
      .update(ConcertSyncSchedule)
      .set({
        nextRunAt: claimedNextRunAt,
        runStartedAt: now,
      })
      .where('id = :id', { id: schedule.id })
      .andWhere('status = :status', { status: 'active' })
      .andWhere('next_run_at = :previousNextRunAt', { previousNextRunAt });

    if (schedule.runStartedAt) {
      claimQb.andWhere('run_started_at = :previousRunStartedAt', {
        previousRunStartedAt: schedule.runStartedAt,
      });
    } else {
      claimQb.andWhere('run_started_at IS NULL');
    }

    const claimResult = await claimQb.execute();
    if (!claimResult.affected) {
      return null;
    }

    schedule.nextRunAt = claimedNextRunAt;
    schedule.runStartedAt = now;
    return schedule;
  }

  private async findOwnerSchedule(id: string, ownerId: number) {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, owner: { id: ownerId } },
      relations: { owner: true, lastJob: true },
    });

    if (!schedule) {
      throw new NotFoundException(`Concert sync schedule ${id} not found`);
    }

    return schedule;
  }

  private computeNextRunAt(cadenceMinutes: number, start = new Date()) {
    return new Date(start.getTime() + cadenceMinutes * 60 * 1000);
  }

  private isRunLocked(schedule: ConcertSyncSchedule, now = new Date()) {
    if (!schedule.runStartedAt) {
      return false;
    }

    return (
      now.getTime() - schedule.runStartedAt.getTime() < this.runLockTimeoutMs
    );
  }

  private getPollIntervalMs() {
    const raw = Number(this.configService.get<string>('CONCERT_SYNC_SCHEDULER_POLL_MS'));
    if (!Number.isFinite(raw)) {
      return 60_000;
    }

    return Math.min(Math.max(raw, 10_000), 300_000);
  }

  private formatSchedule(schedule: ConcertSyncSchedule) {
    return {
      id: schedule.id,
      calendarId: schedule.calendarId,
      status: schedule.status,
      cadenceMinutes: schedule.cadenceMinutes,
      lookaheadDays: schedule.lookaheadDays,
      refreshTopPicks: schedule.refreshTopPicks,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt ?? null,
      lastJobId: schedule.lastJob?.id ?? schedule.lastJobId ?? null,
      lastError: schedule.lastError ?? null,
      hasRefreshToken: Boolean(schedule.encryptedRefreshToken),
      geminiPrompt: schedule.geminiPrompt ?? null,
      geminiContext: schedule.geminiContext ?? null,
      metadata: schedule.scheduleMetadata,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }
}
