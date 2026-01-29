import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private isDbConnected: boolean;

  constructor(
    @Optional() @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.isDbConnected = !!this.configService.get<string>('DATABASE_URL');
  }

  async findOrCreate(createUserDto: CreateUserDto): Promise<User> {
    if (!this.isDbConnected || !this.userRepository) {
      throw new Error('Database not configured. User data cannot be saved.');
    }

    const user = await this.userRepository.findOne({ where: { uid: createUserDto.uid } });

    if (user) {
      return user;
    }

    const newUser = this.userRepository.create(createUserDto);
    return this.userRepository.save(newUser);
  }
}
