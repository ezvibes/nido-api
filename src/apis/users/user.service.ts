import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { VenuePartnerInvite } from './entities/venue-partner-invite.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { CreateVenueInviteDto } from './dto/create-venue-invite.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../../auth/auth.service';
import { Venue } from '../venues/entities/venue.entity';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
    @Optional()
    @InjectRepository(Venue)
    private readonly venueRepository?: Repository<Venue>,
    @Optional()
    @InjectRepository(VenuePartnerInvite)
    private readonly inviteRepository?: Repository<VenuePartnerInvite>,
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

    const inviteCode = dto.inviteCode?.trim().toUpperCase();

    if (inviteCode) {
      if (!this.inviteRepository) {
        throw new Error('Invite repository not configured.');
      }

      const invite = await this.inviteRepository.findOne({
        where: { code: inviteCode },
        relations: ['venue'],
      });

      if (!invite) {
        throw new BadRequestException('Invalid venue partner invite code.');
      }

      if (invite.status !== 'active') {
        throw new BadRequestException(
          'This venue partner invite code has already been used or revoked.',
        );
      }

      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException(
          'This venue partner invite code has expired.',
        );
      }

      if (
        invite.invitedEmail &&
        user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()
      ) {
        throw new ForbiddenException(
          'This invite code is restricted to a different email address.',
        );
      }

      invite.status = 'redeemed';
      invite.redeemedByUserId = user.id;
      invite.redeemedAt = new Date();
      await this.inviteRepository.save(invite);

      user.claimedVenueId = invite.venueId;
      user.claimedVenue = invite.venue;
      user.venueClaimStatus = 'verified';
      user.onboardingCompletedAt = new Date();
      return this.userRepository.save(user);
    }

    if (dto.claimedVenueId) {
      throw new ForbiddenException(
        'A valid venue partner invite code is required to claim a venue.',
      );
    }

    user.claimedVenueId = null;
    user.claimedVenue = null;
    user.venueClaimStatus = 'none';
    user.onboardingCompletedAt = new Date();
    return this.userRepository.save(user);
  }

  async listVenueInvites(): Promise<VenuePartnerInvite[]> {
    if (!this.inviteRepository) {
      throw new Error('Invite repository not configured.');
    }
    return this.inviteRepository.find({
      relations: ['venue', 'redeemedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async createVenueInvite(
    dto: CreateVenueInviteDto,
    creator?: User | null,
  ): Promise<VenuePartnerInvite> {
    if (!this.venueRepository || !this.inviteRepository) {
      throw new Error('Venue or invite repository not configured.');
    }

    const venue = await this.venueRepository.findOne({
      where: { id: dto.venueId },
    });
    if (!venue) {
      throw new NotFoundException(`Venue with ID ${dto.venueId} not found`);
    }

    const code = this.generateInviteCode();
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invite = this.inviteRepository.create({
      code,
      venueId: venue.id,
      venue,
      invitedEmail: dto.invitedEmail?.trim().toLowerCase() || null,
      status: 'active',
      expiresAt,
      createdByUserId: creator?.id ?? null,
    });

    const saved = await this.inviteRepository.save(invite);
    saved.venue = venue;
    return saved;
  }

  async revokeVenueInvite(id: string): Promise<VenuePartnerInvite> {
    if (!this.inviteRepository) {
      throw new Error('Invite repository not configured.');
    }

    const invite = await this.inviteRepository.findOne({
      where: { id },
      relations: ['venue', 'redeemedByUser'],
    });
    if (!invite) {
      throw new NotFoundException(`Venue invite with ID ${id} not found`);
    }

    invite.status = 'revoked';
    return this.inviteRepository.save(invite);
  }

  private generateInviteCode(): string {
    const bytes = randomBytes(8);
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
    }
    return `NIDO-${token}`;
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
