import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ConcertSyncService } from '../concert-sync.service';
import { User } from '../../apis/users/entities/user.entity';

@Injectable()
export class ConcertSyncSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ConcertSyncSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly syncService: ConcertSyncService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    const enabled = this.configService.get<string>('CONCERT_SYNC_SCHEDULER_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log('Concert sync background scheduler is disabled.');
      return;
    }

    const pollMs = Number(this.configService.get<number>('CONCERT_SYNC_SCHEDULER_POLL_MS') || 3600000); // Default to 1 hour if not set or invalid
    this.logger.log(`Starting concert sync background scheduler with interval of ${pollMs}ms...`);

    // Run first sync immediately in the background after startup (wait 5s for app to stabilize)
    setTimeout(() => {
      this.runScheduledSync().catch(err => {
        this.logger.error(`Error in initial background sync run: ${err.message}`, err.stack);
      });
    }, 5000);

    // Setup interval
    this.timer = setInterval(() => {
      this.runScheduledSync().catch(err => {
        this.logger.error(`Error in scheduled background sync run: ${err.message}`, err.stack);
      });
    }, pollMs);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.logger.log('Concert sync background scheduler stopped.');
    }
  }

  private async runScheduledSync() {
    this.logger.log('Running scheduled background concert sync...');

    // 1. Find or create a default user for owning the synced concerts
    const owner = await this.resolveSyncUser();
    if (!owner) {
      this.logger.warn('No user found or created to own background sync jobs. Skipping sync.');
      return;
    }

    // 2. Define target sync range (e.g. today - 1 day to today + 14 days)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 1);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);
    toDate.setHours(23, 59, 59, 999);

    // 3. Define calendars to sync
    const calendars = [
      'ezvibesinc@gmail.com',
      'http://www.jambase.com/calendar/8540E6A6-9ED5-43D6-A7C9-A442AF57E0F0/ical.ics',
    ];

    for (const calendarId of calendars) {
      try {
        this.logger.log(`Starting scheduled sync for calendar: ${calendarId}`);
        await this.syncService.createJobForOwner(owner, {
          calendarId,
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          maxEvents: 50,
          dryRun: false,
          refreshTopPicks: true,
        });
      } catch (err) {
        this.logger.error(`Failed to start scheduled sync job for calendar ${calendarId}: ${err.message}`, err.stack);
      }
    }
  }

  private async resolveSyncUser(): Promise<User | null> {
    // 1. Try admin emails
    const adminEmailsStr = this.configService.get<string>('ADMIN_EMAILS') || '';
    const adminEmail = adminEmailsStr.split(',')[0]?.trim();

    if (adminEmail) {
      const user = await this.userRepository.findOne({ where: { email: adminEmail } });
      if (user) return user;
    }

    // 2. Try by system sync bot uid
    const botUser = await this.userRepository.findOne({ where: { uid: 'sync-bot-system-uid' } });
    if (botUser) return botUser;

    // 3. Try to find any user
    const anyUser = await this.userRepository.findOne({ where: {} });
    if (anyUser) return anyUser;

    // 4. Create one
    try {
      const email = adminEmail || 'ezvibesinc@gmail.com';
      // Ensure the email is not already taken by some other user
      const existingByEmail = await this.userRepository.findOne({ where: { email } });
      const finalEmail = existingByEmail ? `sync-bot-${Date.now()}@example.com` : email;

      return await this.userRepository.save(
        this.userRepository.create({
          email: finalEmail,
          uid: 'sync-bot-system-uid',
          name: 'Sync Bot',
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to resolve/create system sync user: ${err.message}`, err.stack);
      return null;
    }
  }
}
