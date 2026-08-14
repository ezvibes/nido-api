import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertUpvote } from './entities/concert-upvote.entity';
import { ConcertService } from './concert.service';
import { ConcertController } from './concert.controller';
import { AdminConcertController } from './admin-concert.controller';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../users/user.module';

import { ConcertBandLineup } from './entities/concert-band-lineup.entity';
import { ConcertSet } from './entities/concert-set.entity';
import { IngestionModule } from '../../ingestion/ingestion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, ConcertUpvote, ConcertBandLineup, ConcertSet]),
    AuthModule,
    UserModule,
    IngestionModule,
  ],
  controllers: [ConcertController, AdminConcertController],
  providers: [ConcertService],
})
export class ConcertModule {}
