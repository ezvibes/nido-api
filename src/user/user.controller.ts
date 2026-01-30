import {
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  Patch,
  Body,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async syncUser(@CurrentUser() user: DecodedIdToken): Promise<User> {
    const { uid, email, picture } = user;

    if (!email) {
      throw new BadRequestException(
        'Email not found in Firebase token. An email is required to create or sync a user.',
      );
    }

    const createUserDto: CreateUserDto = { uid, email, picture };
    return this.userService.findOrCreate(createUserDto);
  }

  @Patch('profile')
  @UseGuards(FirebaseAuthGuard)
  async updateProfile(
    @CurrentUser() user: DecodedIdToken,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(user.uid, updateUserDto);
  }
}

