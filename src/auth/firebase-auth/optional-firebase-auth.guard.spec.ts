import { OptionalFirebaseAuthGuard } from './optional-firebase-auth.guard';

describe('OptionalFirebaseAuthGuard', () => {
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  it('allows anonymous requests without invoking Firebase', async () => {
    const authService = {
      verifyIdToken: jest.fn(),
    };
    const guard = new OptionalFirebaseAuthGuard(
      authService as any,
      configService as any,
    );
    const request = { headers: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.verifyIdToken).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('user');
  });

  it('verifies and attaches a user when a bearer token is supplied', async () => {
    const authService = {
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-user' }),
    };
    const guard = new OptionalFirebaseAuthGuard(
      authService as any,
      configService as any,
    );
    const request = {
      headers: { authorization: 'Bearer firebase-token' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.verifyIdToken).toHaveBeenCalledWith('firebase-token');
    expect(request).toMatchObject({ user: { uid: 'firebase-user' } });
  });

  it('rejects invalid optional bearer tokens instead of ignoring them', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const authService = {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid token')),
    };
    const guard = new OptionalFirebaseAuthGuard(
      authService as any,
      configService as any,
    );
    const request = {
      headers: { authorization: 'Bearer invalid-token' },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      'Invalid or expired token.',
    );
    consoleError.mockRestore();
  });
});

function createContext(request: {
  headers: Record<string, string>;
  user?: unknown;
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
