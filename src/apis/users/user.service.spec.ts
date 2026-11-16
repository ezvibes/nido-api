import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

describe('UserService', () => {
  const authService = {
    getUserProfileFromToken: jest.fn(),
  };

  function createService(repositoryOverrides = {}, venueOverrides = {}) {
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

    const service = new UserService(
      repository as any,
      authService as any,
      venueRepository as any,
    );
    return { service, repository, venueRepository };
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

  it('claims a venue during onboarding and marks status pending', async () => {
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
    const { service, repository } = createService(
      { findOne: jest.fn().mockResolvedValue(existingUser) },
      { findOne: jest.fn().mockResolvedValue(bowstring) },
    );

    const result = await service.updateOnboarding('matt-uid', {
      claimedVenueId: bowstring.id,
    });

    expect(result.claimedVenueId).toBe(bowstring.id);
    expect(result.claimedVenue).toEqual(bowstring);
    expect(result.venueClaimStatus).toBe('pending');
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(existingUser);
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

  it('throws NotFoundException when claiming a non-existent venue', async () => {
    const existingUser = {
      id: 6,
      uid: 'matt-uid',
      email: 'matt@bowstring.com',
    } as User;
    const { service } = createService(
      { findOne: jest.fn().mockResolvedValue(existingUser) },
      { findOne: jest.fn().mockResolvedValue(null) },
    );

    await expect(
      service.updateOnboarding('matt-uid', {
        claimedVenueId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
