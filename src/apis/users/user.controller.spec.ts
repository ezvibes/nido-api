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
});
