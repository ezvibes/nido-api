import { UserController } from './user.controller';
import { VenueInviteController } from './venue-invite.controller';
import { UserService } from './user.service';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UserController & VenueInviteController', () => {
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
      venueClaimStatus: 'verified',
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
      venueClaimStatus: 'verified',
    };
    const userService = {
      updateOnboarding: jest.fn().mockResolvedValue(updatedUser),
    } as unknown as UserService;

    const controller = new UserController(userService);
    const currentUser = { uid: 'uid-123' } as DecodedIdToken;
    const dto = { inviteCode: 'NIDO-BOWSTRNG' };

    await expect(
      controller.updateOnboarding(currentUser, dto),
    ).resolves.toEqual(updatedUser);
    expect(userService.updateOnboarding).toHaveBeenCalledWith('uid-123', dto);
  });

  it('VenueInviteController lists, creates, and revokes invites via UserService', async () => {
    const adminUser = { id: 99, uid: 'admin-uid', email: 'admin@example.com' };
    const invite = {
      id: 'invite-1',
      code: 'NIDO-BOWSTRNG',
      venueId: 'venue-1',
      status: 'active',
    };
    const userService = {
      syncFromToken: jest.fn().mockResolvedValue(adminUser),
      listVenueInvites: jest.fn().mockResolvedValue([invite]),
      createVenueInvite: jest.fn().mockResolvedValue(invite),
      revokeVenueInvite: jest
        .fn()
        .mockResolvedValue({ ...invite, status: 'revoked' }),
    } as unknown as UserService;

    const controller = new VenueInviteController(userService);
    const token = {
      uid: 'admin-uid',
      email: 'admin@example.com',
    } as DecodedIdToken;

    await expect(controller.listInvites()).resolves.toEqual([invite]);
    await expect(
      controller.createInvite(token, {
        venueId: 'venue-1',
        invitedEmail: 'matt@bowstring.com',
      }),
    ).resolves.toEqual(invite);
    expect(userService.createVenueInvite).toHaveBeenCalledWith(
      { venueId: 'venue-1', invitedEmail: 'matt@bowstring.com' },
      adminUser,
    );

    await expect(controller.revokeInvite('invite-1')).resolves.toEqual({
      ...invite,
      status: 'revoked',
    });
    expect(userService.revokeVenueInvite).toHaveBeenCalledWith('invite-1');
  });
});
