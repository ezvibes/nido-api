import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Band } from './entities/band.entity';
import { BandService } from './band.service';
import { BandController } from './band.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Band]),
    AuthModule,
  ],
  controllers: [BandController],
  providers: [BandService],
  exports: [BandService],
})
export class BandModule {}
