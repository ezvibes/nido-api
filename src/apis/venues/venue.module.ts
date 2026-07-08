import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [VenueController],
  providers: [VenueService],
  exports: [VenueService],
})
export class VenueModule {}
