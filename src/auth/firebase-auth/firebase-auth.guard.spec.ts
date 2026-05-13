import { FirebaseAuthGuard } from './firebase-auth.guard';

describe('FirebaseAuthGuard', () => {
  it('should be defined', () => {
    const authService = {
      verifyIdToken: jest.fn(),
    };
    const configService = {
      get: jest.fn(),
    };
    expect(
      new FirebaseAuthGuard(authService as any, configService as any),
    ).toBeDefined();
  });

  it('verifies firebase bearer tokens by default', async () => {
    const authService = {
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-user' }),
    };
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const guard = new FirebaseAuthGuard(authService as any, configService as any);
    const request = {
      headers: {
        authorization: 'Bearer firebase-token',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(authService.verifyIdToken).toHaveBeenCalledWith('firebase-token');
    expect(request).toMatchObject({ user: { uid: 'firebase-user' } });
  });

  it('injects a dev user when local auth bypass is enabled', async () => {
    const authService = {
      verifyIdToken: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_DEV_BYPASS') {
          return 'true';
        }
        if (key === 'NODE_ENV') {
          return 'development';
        }
        if (key === 'FIREBASE_PROJECT_ID') {
          return 'nido-dev';
        }
        return undefined;
      }),
    };
    const guard = new FirebaseAuthGuard(authService as any, configService as any);
    const request = {
      headers: {
        'x-dev-user-uid': 'bruno-user',
        'x-dev-user-email': 'bruno@example.local',
        'x-dev-user-name': 'Bruno User',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(authService.verifyIdToken).not.toHaveBeenCalled();
    expect(request).toMatchObject({
      user: {
        aud: 'nido-dev',
        email: 'bruno@example.local',
        name: 'Bruno User',
        uid: 'bruno-user',
      },
    });
  });

  it('does not allow dev bypass in production', async () => {
    const authService = {
      verifyIdToken: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_DEV_BYPASS') {
          return 'true';
        }
        if (key === 'NODE_ENV') {
          return 'production';
        }
        return undefined;
      }),
    };
    const guard = new FirebaseAuthGuard(authService as any, configService as any);

    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toThrow(
      'Authorization header is missing.',
    );
  });
});

function createContext(request: { headers: Record<string, string> }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
