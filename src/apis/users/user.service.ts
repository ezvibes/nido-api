import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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

  async findExistingFromToken(
    decodedToken: DecodedIdToken,
  ): Promise<User | null> {
    const userProfile = this.authService.getUserProfileFromToken(decodedToken);
    return this.findExisting(userProfile);
  }

  async findOrCreate(createUserDto: CreateUserDto): Promise<User> {
    if (!this.userRepository) {
      throw new Error('Database not configured. User data cannot be saved.');
    }

    const existingUser = await this.findExisting(createUserDto);
    if (existingUser) {
      return this.refreshUser(existingUser, createUserDto);
    }

    const newUser = this.userRepository.create(createUserDto);
    try {
      return await this.userRepository.save(newUser);
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }

      // Another authenticated request may have created the same user between
      // our lookup and insert. Read the winner instead of returning a 500.
      const concurrentlyCreatedUser = await this.findExisting(createUserDto);
      if (!concurrentlyCreatedUser) {
        throw error;
      }

      return this.refreshUser(concurrentlyCreatedUser, createUserDto);
    }
  }

  async update(uid: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { uid } });

    if (!user) {
      throw new NotFoundException(`User with UID ${uid} not found`);
    }

    this.userRepository.merge(user, updateUserDto);
    return this.userRepository.save(user);
  }

  private async findExisting(
    userProfile: Pick<CreateUserDto, 'email' | 'uid'>,
  ): Promise<User | null> {
    const userByEmail = await this.userRepository.findOne({
      where: { email: userProfile.email },
    });
    if (userByEmail) {
      return userByEmail;
    }

    return this.userRepository.findOne({
      where: { uid: userProfile.uid },
    });
  }

  private refreshUser(user: User, profile: CreateUserDto): Promise<User> {
    this.userRepository.merge(user, {
      email: profile.email,
      uid: profile.uid,
      picture: profile.picture,
    });
    return this.userRepository.save(user);
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    return (
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    );
  }
}
