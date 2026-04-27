import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngestionJob } from './entities/ingestion-job.entity';
import { SourceAsset } from './entities/source-asset.entity';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { VisionOcrService } from './ocr/vision-ocr.service';
import { IngestionStorageService } from './storage/ingestion-storage.service';
import { IngestionWorkerRunner } from './worker/ingestion-worker.runner';
import { IngestionWorkerService } from './worker/ingestion-worker.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([SourceAsset, IngestionJob]),
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IngestionStorageService,
    VisionOcrService,
    IngestionWorkerService,
    IngestionWorkerRunner,
  ],
  exports: [IngestionService, IngestionWorkerService, IngestionWorkerRunner],
})
export class IngestionModule {}
