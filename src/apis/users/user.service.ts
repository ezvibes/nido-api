import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../../auth/auth.service';
import { Venue } from '../venues/entities/venue.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
    @Optional()
    @InjectRepository(Venue)
    private readonly venueRepository?: Repository<Venue>,
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
    const user = await this.userRepository.findOne({
      where: { uid },
      relations: ['claimedVenue'],
    });

    if (!user) {
      throw new NotFoundException(`User with UID ${uid} not found`);
    }

    this.userRepository.merge(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async updateOnboarding(uid: string, dto: UpdateOnboardingDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { uid },
      relations: ['claimedVenue'],
    });

    if (!user) {
      throw new NotFoundException(`User with UID ${uid} not found`);
    }

    if (dto.claimedVenueId) {
      if (!this.venueRepository) {
        throw new Error('Venue repository not configured.');
      }
      const venue = await this.venueRepository.findOne({
        where: { id: dto.claimedVenueId },
      });
      if (!venue) {
        throw new NotFoundException(
          `Venue with ID ${dto.claimedVenueId} not found`,
        );
      }

      const keepVerified =
        user.claimedVenueId === venue.id &&
        user.venueClaimStatus === 'verified';
      user.claimedVenueId = venue.id;
      user.claimedVenue = venue;
      user.venueClaimStatus = keepVerified ? 'verified' : 'pending';
    } else {
      user.claimedVenueId = null;
      user.claimedVenue = null;
      user.venueClaimStatus = 'none';
    }

    user.onboardingCompletedAt = new Date();
    return this.userRepository.save(user);
  }

  private async findExisting(
    userProfile: Pick<CreateUserDto, 'email' | 'uid'>,
  ): Promise<User | null> {
    const userByEmail = await this.userRepository.findOne({
      where: { email: userProfile.email },
      relations: ['claimedVenue'],
    });
    if (userByEmail) {
      return userByEmail;
    }

    return this.userRepository.findOne({
      where: { uid: userProfile.uid },
      relations: ['claimedVenue'],
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
