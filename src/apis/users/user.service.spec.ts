import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  const authService = {
    getUserProfileFromToken: jest.fn(),
  };

  function createService(
    repositoryOverrides = {},
    venueOverrides = {},
    inviteOverrides = {},
  ) {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      merge: jest.fn((target, source) => Object.assign(target, source)),
      save: jest.fn(async (user) => user),
      ...repositoryOverrides,
    };

    const venueRepository = {
      findOne: jest.fn(),
      ...venueOverrides,
    };

    const inviteRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (invite) => invite),
      ...inviteOverrides,
    };

    const service = new UserService(
      repository as any,
      authService as any,
      venueRepository as any,
      inviteRepository as any,
    );
    return { service, repository, venueRepository, inviteRepository };
  }

  it('returns and refreshes an existing user found by uid', async () => {
    const existingUser = {
      id: 1,
      uid: 'firebase-uid',
      email: 'old@example.com',
    } as User;

    const { service, repository } = createService({
      findOne: jest.fn().mockImplementation(async (query) => {
        if (query.where?.uid === 'firebase-uid') {
          return existingUser;
        }
        return null;
      }),
    });

    await expect(
      service.findOrCreate({
        uid: 'firebase-uid',
        email: 'new@example.com',
        picture: 'https://example.com/photo.jpg',
      }),
    ).resolves.toMatchObject({
      id: 1,
      uid: 'firebase-uid',
      email: 'new@example.com',
      picture: 'https://example.com/photo.jpg',
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(existingUser);
  });

  it('links an existing user found by email when Firebase uid changes', async () => {
    const existingUser = {
      id: 2,
      uid: 'old-firebase-uid',
      email: 'ezvibesinc@gmail.com',
    } as User;

    const { service, repository } = createService({
      findOne: jest.fn().mockImplementation(async (query) => {
        if (query.where?.email === 'ezvibesinc@gmail.com') {
          return existingUser;
        }
        return null;
      }),
    });

    await expect(
      service.findOrCreate({
        uid: 'new-firebase-uid',
        email: 'ezvibesinc@gmail.com',
        picture: 'https://example.com/new-photo.jpg',
      }),
    ).resolves.toMatchObject({
      id: 2,
      uid: 'new-firebase-uid',
      email: 'ezvibesinc@gmail.com',
      picture: 'https://example.com/new-photo.jpg',
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(existingUser);
  });

  it('creates a user when neither uid nor email exists', async () => {
    const { service, repository } = createService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await service.findOrCreate({
      uid: 'new-user',
      email: 'new@example.com',
      picture: undefined,
    });

    expect(repository.findOne).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith({
      uid: 'new-user',
      email: 'new@example.com',
      picture: undefined,
    });
  });

  it('returns the winning user when concurrent requests race to create it', async () => {
    const winningUser = {
      id: 9,
      uid: 'new-user',
      email: 'new@example.com',
    } as User;
    const uniqueConflict = new QueryFailedError('INSERT INTO "user"', [], {
      code: '23505',
    } as any);
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winningUser);
    const save = jest
      .fn()
      .mockRejectedValueOnce(uniqueConflict)
      .mockResolvedValueOnce(winningUser);
    const { service } = createService({ findOne, save });

    await expect(
      service.findOrCreate({
        uid: 'new-user',
        email: 'new@example.com',
        picture: 'https://example.com/photo.jpg',
      }),
    ).resolves.toMatchObject({
      id: 9,
      uid: 'new-user',
      email: 'new@example.com',
      picture: 'https://example.com/photo.jpg',
    });

    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not hide non-unique database failures', async () => {
    const databaseFailure = new QueryFailedError('INSERT INTO "user"', [], {
      code: '08006',
    } as any);
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockRejectedValue(databaseFailure),
    });

    await expect(
      service.findOrCreate({
        uid: 'new-user',
        email: 'new@example.com',
        picture: undefined,
      }),
    ).rejects.toBe(databaseFailure);
  });

  it('looks up optional feed engagement without writing the user', async () => {
    const existingUser = {
      id: 3,
      uid: 'firebase-user',
      email: 'listener@example.com',
    } as User;
    authService.getUserProfileFromToken.mockReturnValue({
      uid: 'firebase-user',
      email: 'listener@example.com',
    });
    const { service, repository } = createService({
      findOne: jest.fn().mockResolvedValueOnce(existingUser),
    });

    await expect(
      service.findExistingFromToken({ uid: 'firebase-user' } as any),
    ).resolves.toBe(existingUser);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('redeems a valid venue partner invite code and marks venueClaimStatus verified', async () => {
    const existingUser = {
      id: 4,
      uid: 'matt-uid',
      email: 'matt@bowstring.com',
      venueClaimStatus: 'none',
    } as User;
    const bowstring = {
      id: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
      name: 'Bowstring Brewyard',
      city: 'Raleigh',
    };
    const activeInvite = {
      id: 'invite-1',
      code: 'NIDO-BOWSTRNG',
      venueId: bowstring.id,
      venue: bowstring,
      invitedEmail: 'matt@bowstring.com',
      status: 'active',
      expiresAt: null,
    };

    const { service, repository, inviteRepository } = createService(
      { findOne: jest.fn().mockResolvedValue(existingUser) },
      {},
      { findOne: jest.fn().mockResolvedValue(activeInvite) },
    );

    const result = await service.updateOnboarding('matt-uid', {
      inviteCode: ' nido-bowstrng ',
    });

    expect(inviteRepository.findOne).toHaveBeenCalledWith({
      where: { code: 'NIDO-BOWSTRNG' },
      relations: ['venue'],
    });
    expect(inviteRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'redeemed',
        redeemedByUserId: 4,
        redeemedAt: expect.any(Date),
      }),
    );
    expect(result.claimedVenueId).toBe(bowstring.id);
    expect(result.claimedVenue).toEqual(bowstring);
    expect(result.venueClaimStatus).toBe('verified');
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(existingUser);
  });

  it('rejects open claimedVenueId requests without an inviteCode with ForbiddenException', async () => {
    const existingUser = {
      id: 4,
      uid: 'uninvited-uid',
      email: 'random@example.com',
      venueClaimStatus: 'none',
    } as User;

    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(existingUser),
    });

    await expect(
      service.updateOnboarding('uninvited-uid', {
        claimedVenueId: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an email-restricted invite when redeemed by a different email', async () => {
    const existingUser = {
      id: 7,
      uid: 'other-uid',
      email: 'intruder@example.com',
      venueClaimStatus: 'none',
    } as User;
    const invite = {
      id: 'invite-2',
      code: 'NIDO-RESTRICT',
      venueId: 'venue-1',
      venue: { id: 'venue-1', name: 'Bowstring Brewyard' },
      invitedEmail: 'matt@bowstring.com',
      status: 'active',
    };

    const { service } = createService(
      { findOne: jest.fn().mockResolvedValue(existingUser) },
      {},
      { findOne: jest.fn().mockResolvedValue(invite) },
    );

    await expect(
      service.updateOnboarding('other-uid', { inviteCode: 'NIDO-RESTRICT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid, already-redeemed, revoked, or expired invite codes with BadRequestException', async () => {
    const existingUser = {
      id: 8,
      uid: 'matt-uid',
      email: 'matt@bowstring.com',
      venueClaimStatus: 'none',
    } as User;

    const { service, inviteRepository } = createService({
      findOne: jest.fn().mockResolvedValue(existingUser),
    });

    // Missing invite
    inviteRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.updateOnboarding('matt-uid', { inviteCode: 'NIDO-UNKNOWN1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Already redeemed invite
    inviteRepository.findOne.mockResolvedValueOnce({
      id: 'inv-used',
      code: 'NIDO-USED1234',
      status: 'redeemed',
    });
    await expect(
      service.updateOnboarding('matt-uid', { inviteCode: 'NIDO-USED1234' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Expired invite
    inviteRepository.findOne.mockResolvedValueOnce({
      id: 'inv-exp',
      code: 'NIDO-EXPIRED1',
      status: 'active',
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(
      service.updateOnboarding('matt-uid', { inviteCode: 'NIDO-EXPIRED1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes onboarding as a fan without claiming a venue', async () => {
    const existingUser = {
      id: 5,
      uid: 'fan-uid',
      email: 'fan@example.com',
      claimedVenueId: 'old-venue-id',
      venueClaimStatus: 'pending',
    } as User;
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(existingUser),
    });

    const result = await service.updateOnboarding('fan-uid', {
      skipAsFan: true,
    });

    expect(result.claimedVenueId).toBeNull();
    expect(result.claimedVenue).toBeNull();
    expect(result.venueClaimStatus).toBe('none');
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('creates a NIDO-XXXXXXXX venue partner invite and revokes it cleanly', async () => {
    const bowstring = {
      id: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
      name: 'Bowstring Brewyard',
      city: 'Raleigh',
    };
    const creator = { id: 99, email: 'admin@example.com' } as User;

    const { service, inviteRepository } = createService(
      {},
      { findOne: jest.fn().mockResolvedValue(bowstring) },
    );

    const created = await service.createVenueInvite(
      {
        venueId: bowstring.id,
        invitedEmail: 'Matt@Bowstring.com ',
        expiresInDays: 14,
      },
      creator,
    );

    expect(created.code).toMatch(/^NIDO-[A-Z0-9]{8}$/);
    expect(created.venueId).toBe(bowstring.id);
    expect(created.invitedEmail).toBe('matt@bowstring.com');
    expect(created.status).toBe('active');
    expect(created.createdByUserId).toBe(99);
    expect(created.expiresAt).toBeInstanceOf(Date);

    inviteRepository.findOne.mockResolvedValueOnce(created);
    const revoked = await service.revokeVenueInvite('invite-99');
    expect(revoked.status).toBe('revoked');
  });
});
