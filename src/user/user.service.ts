import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreate(createUserDto: CreateUserDto): Promise<User> {
    if (!this.userRepository) {
      throw new Error('Database not configured. User data cannot be saved.');
    }

    const user = await this.userRepository.findOne({
      where: { uid: createUserDto.uid },
    });

    if (user) {
      return user;
    }

    const newUser = this.userRepository.create(createUserDto);
    return this.userRepository.save(newUser);
  }

  async update(uid: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { uid } });

    if (!user) {
      throw new NotFoundException(`User with UID ${uid} not found`);
    }

    this.userRepository.merge(user, updateUserDto);
    return this.userRepository.save(user);
  }
}

