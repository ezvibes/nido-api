import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
// import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
// import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('sync')
  // @UseGuards(FirebaseAuthGuard)
  async syncUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.findOrCreate(createUserDto);
  }
}
