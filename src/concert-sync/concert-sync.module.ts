import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { UserModule } from '../apis/users/user.module';
import { AuthModule } from '../auth/auth.module';
import { VenueModule } from '../apis/venues/venue.module';
import { BandModule } from '../apis/bands/band.module';
import { ConcertSyncController } from './concert-sync.controller';
import { ConcertSyncService } from './concert-sync.service';
import { ConcertSyncEvent } from './entities/concert-sync-event.entity';
import { ConcertSyncJob } from './entities/concert-sync-job.entity';
import { GeminiConcertExtractorService } from './services/gemini-concert-extractor.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { IcalCalendarClientService } from './services/ical-calendar-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, ConcertSyncEvent, ConcertSyncJob]),
    AuthModule,
    UserModule,
    VenueModule,
    BandModule,
  ],
  controllers: [ConcertSyncController],
  providers: [
    ConcertSyncService,
    GoogleCalendarClientService,
    IcalCalendarClientService,
    GeminiConcertExtractorService,
  ],
  exports: [ConcertSyncService],
})
export class ConcertSyncModule {}
