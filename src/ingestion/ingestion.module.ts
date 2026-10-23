import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../apis/users/user.module';
import { VenueModule } from '../apis/venues/venue.module';
import { BandModule } from '../apis/bands/band.module';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { ConcertUpload } from './entities/concert-upload.entity';
import { IngestionCandidate } from './entities/ingestion-candidate.entity';
import { IngestionOutbox } from './entities/ingestion-outbox.entity';
import { AdminIngestionController } from './admin-ingestion.controller';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionStateMachineService } from './services/ingestion-state-machine.service';
import { GeminiExtractionAdapter } from './services/extraction/gemini-extraction.adapter';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UserModule,
    VenueModule,
    BandModule,
    TypeOrmModule.forFeature([
      Concert,
      ConcertUpload,
      IngestionJob,
      IngestionCandidate,
      IngestionOutbox,
    ]),
  ],
  controllers: [IngestionController, AdminIngestionController],
  providers: [
    IngestionService,
    IngestionStateMachineService,
    GeminiExtractionAdapter,
  ],
  exports: [
    IngestionService,
    IngestionStateMachineService,
    GeminiExtractionAdapter,
  ],
})
export class IngestionModule {}
