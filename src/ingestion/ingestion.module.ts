import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../apis/users/user.module';
import { Concert } from '../apis/concerts/entities/concert.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { ConcertUpload } from './entities/concert-upload.entity';
import { AdminIngestionController } from './admin-ingestion.controller';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UserModule,
    TypeOrmModule.forFeature([Concert, ConcertUpload, IngestionJob]),
  ],
  controllers: [IngestionController, AdminIngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
