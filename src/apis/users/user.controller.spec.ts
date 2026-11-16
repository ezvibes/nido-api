import { UserController } from './user.controller';
import { UserService } from './user.service';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UserController', () => {
  it('updateProfile should call userService.update with uid and payload', async () => {
    const userService = {
      update: jest.fn().mockResolvedValue({
        id: 1,
        uid: 'uid-123',
        email: 'test@example.com',
        name: 'Test User',
      }),
    } as unknown as UserService;

    const controller = new UserController(userService);
    const currentUser = { uid: 'uid-123' } as DecodedIdToken;
    const updateUserDto: UpdateUserDto = { name: 'Updated Name' };

    await controller.updateProfile(currentUser, updateUserDto);

    expect(userService.update).toHaveBeenCalledTimes(1);
    expect(userService.update).toHaveBeenCalledWith('uid-123', updateUserDto);
  });

  it('getMe should return synced user profile with claimed venue state', async () => {
    const syncedUser = {
      id: 1,
      uid: 'uid-123',
      email: 'matt@bowstring.com',
      venueClaimStatus: 'pending',
    };
    const userService = {
      syncFromToken: jest.fn().mockResolvedValue(syncedUser),
    } as unknown as UserService;

    const controller = new UserController(userService);
    const currentUser = { uid: 'uid-123' } as DecodedIdToken;

    await expect(controller.getMe(currentUser)).resolves.toEqual(syncedUser);
    expect(userService.syncFromToken).toHaveBeenCalledWith(currentUser);
  });

  it('updateOnboarding should call userService.updateOnboarding with uid and dto', async () => {
    const updatedUser = {
      id: 1,
      uid: 'uid-123',
      claimedVenueId: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
      venueClaimStatus: 'pending',
    };
    const userService = {
      updateOnboarding: jest.fn().mockResolvedValue(updatedUser),
    } as unknown as UserService;

    const controller = new UserController(userService);
    const currentUser = { uid: 'uid-123' } as DecodedIdToken;
    const dto = { claimedVenueId: 'e6efac75-ab36-46fb-a79d-4c3807a083f0' };

    await expect(
      controller.updateOnboarding(currentUser, dto),
    ).resolves.toEqual(updatedUser);
    expect(userService.updateOnboarding).toHaveBeenCalledWith('uid-123', dto);
  });
});
