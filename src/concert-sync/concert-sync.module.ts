import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { UserModule } from '../apis/users/user.module';
import { AuthModule } from '../auth/auth.module';
import { ConcertSyncController } from './concert-sync.controller';
import { ConcertSyncScheduleService } from './concert-sync-schedule.service';
import { ConcertSyncService } from './concert-sync.service';
import { ConcertSyncEvent } from './entities/concert-sync-event.entity';
import { ConcertSyncJob } from './entities/concert-sync-job.entity';
import { ConcertSyncSchedule } from './entities/concert-sync-schedule.entity';
import { GeminiConcertExtractorService } from './services/gemini-concert-extractor.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { GoogleOAuthTokenService } from './services/google-oauth-token.service';
import { TokenProtectionService } from './services/token-protection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Concert,
      ConcertSyncEvent,
      ConcertSyncJob,
      ConcertSyncSchedule,
    ]),
    AuthModule,
    UserModule,
  ],
  controllers: [ConcertSyncController],
  providers: [
    ConcertSyncService,
    ConcertSyncScheduleService,
    GoogleCalendarClientService,
    GeminiConcertExtractorService,
    GoogleOAuthTokenService,
    TokenProtectionService,
  ],
  exports: [ConcertSyncService],
})
export class ConcertSyncModule {}
