import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { VenuePartnerInvite } from './entities/venue-partner-invite.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { VenueInviteController } from './venue-invite.controller';
import { AuthModule } from '../../auth/auth.module';
import { Venue } from '../venues/entities/venue.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Venue, VenuePartnerInvite]),
    AuthModule,
  ],
  providers: [UserService],
  controllers: [UserController, VenueInviteController],
  exports: [UserService],
})
export class UserModule {}
