import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { GoogleOidcGuard } from './google-oidc.guard';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: mockVerifyIdToken,
      };
    }),
  };
});

describe('GoogleOidcGuard', () => {
  let guard: GoogleOidcGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'INGESTION_WORKER_AUDIENCE') return 'https://test-worker-url/audience';
        if (key === 'INGESTION_WORKER_URL') return 'https://test-worker-url/process';
        if (key === 'CLOUD_TASKS_INVOKER_SA') return 'test-sa@test-project.iam.gserviceaccount.com';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOidcGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<GoogleOidcGuard>(GoogleOidcGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: authHeader,
          },
        }),
      }),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException if no auth header', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if auth header is not Bearer', async () => {
    const context = createMockContext('Basic dGVzdDp0ZXN0');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if missing config', async () => {
    (mockConfigService.get as jest.Mock).mockReturnValue(undefined);
    const context = createMockContext('Bearer test-token');
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should return true for valid token and email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'test-sa@test-project.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });

    const context = createMockContext('Bearer valid-token');
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-token',
      audience: 'https://test-worker-url/audience',
    });
  });

  it('should throw ForbiddenException for unauthorized email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'attacker@test-project.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });

    const context = createMockContext('Bearer attacker-token');
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException if verifyIdToken fails', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid signature'));

    const context = createMockContext('Bearer invalid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
