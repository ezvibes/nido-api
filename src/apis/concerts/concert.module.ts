import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertService } from './concert.service';
import { ConcertController } from './concert.controller';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Concert]), AuthModule, UserModule],
  controllers: [ConcertController],
  providers: [ConcertService],
})
export class ConcertModule {}
