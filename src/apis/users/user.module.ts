import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../../auth/auth.module';
import { Venue } from '../venues/entities/venue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Venue]), AuthModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
