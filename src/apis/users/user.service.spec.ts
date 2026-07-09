import { UserService } from './user.service';
import { User } from './entities/user.entity';

describe('UserService', () => {
  const authService = {
    getUserProfileFromToken: jest.fn(),
  };

  function createService(repositoryOverrides = {}) {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      merge: jest.fn((target, source) => Object.assign(target, source)),
      save: jest.fn(async (user) => user),
      ...repositoryOverrides,
    };

    const service = new UserService(repository as any, authService as any);
    return { service, repository };
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
});
