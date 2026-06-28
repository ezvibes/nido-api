import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async syncFromToken(decodedToken: DecodedIdToken): Promise<User> {
    const createUserDto: CreateUserDto =
      this.authService.getUserProfileFromToken(decodedToken);
    return this.findOrCreate(createUserDto);
  }

  async findOrCreate(createUserDto: CreateUserDto): Promise<User> {
    if (!this.userRepository) {
      throw new Error('Database not configured. User data cannot be saved.');
    }

    const userByUid = await this.userRepository.findOne({
      where: { uid: createUserDto.uid },
    });

    if (userByUid) {
      this.userRepository.merge(userByUid, {
        email: createUserDto.email,
        picture: createUserDto.picture,
      });
      return this.userRepository.save(userByUid);
    }

    const userByEmail = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (userByEmail) {
      this.userRepository.merge(userByEmail, {
        uid: createUserDto.uid,
        picture: createUserDto.picture,
      });
      return this.userRepository.save(userByEmail);
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
