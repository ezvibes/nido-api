import { Controller, Get, Post, UseGuards, Patch, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMe(@CurrentUser() user: DecodedIdToken): Promise<User> {
    return this.userService.syncFromToken(user);
  }

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async syncUser(@CurrentUser() user: DecodedIdToken): Promise<User> {
    return this.userService.syncFromToken(user);
  }

  @Patch('profile')
  @UseGuards(FirebaseAuthGuard)
  async updateProfile(
    @CurrentUser() user: DecodedIdToken,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(user.uid, updateUserDto);
  }

  @Patch('me/onboarding')
  @UseGuards(FirebaseAuthGuard)
  async updateOnboarding(
    @CurrentUser() user: DecodedIdToken,
    @Body() updateOnboardingDto: UpdateOnboardingDto,
  ): Promise<User> {
    return this.userService.updateOnboarding(user.uid, updateOnboardingDto);
  }
}
