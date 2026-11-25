import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstagramConnection } from './entities/instagram-connection.entity';
import { InstagramAuthService } from './instagram-auth.service';
import {
  decryptInstagramToken,
  encryptInstagramToken,
} from './utils/instagram-token-crypto.util';

describe('InstagramAuthService', () => {
  let service: InstagramAuthService;
  let storedConnections: InstagramConnection[];
  let fetchSpy: jest.SpyInstance;

  const encryptionKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const configValues: Record<string, string> = {
    META_APP_ID: 'meta-app-123',
    META_APP_SECRET: 'meta-secret-456',
    META_INSTAGRAM_REDIRECT_URI:
      'https://admin.example.com/admin/instagram/oauth/callback',
    INSTAGRAM_TOKEN_ENCRYPTION_KEY: encryptionKey,
  };

  const mockRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.instagramUserId) {
        return (
          storedConnections.find(
            (c) => c.instagramUserId === where.instagramUserId,
          ) ?? null
        );
      }
      if (where?.id) {
        return storedConnections.find((c) => c.id === where.id) ?? null;
      }
      if (where?.status) {
        return (
          storedConnections.find((c) => c.status === where.status) ?? null
        );
      }
      return null;
    }),
    find: jest.fn(async () => [...storedConnections]),
    create: jest.fn((data: Partial<InstagramConnection>) => ({
      id: 'conn-uuid-1',
      scopes: [],
      status: 'connected',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (entity: InstagramConnection) => {
      const idx = storedConnections.findIndex(
        (c) => c.instagramUserId === entity.instagramUserId,
      );
      const saved = {
        ...entity,
        id: entity.id || 'conn-uuid-1',
        updatedAt: new Date(),
      } as InstagramConnection;
      if (idx >= 0) {
        storedConnections[idx] = saved;
      } else {
        storedConnections.push(saved);
      }
      return saved;
    }),
  };

  beforeEach(async () => {
    storedConnections = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramAuthService,
        {
          provide: getRepositoryToken(InstagramConnection),
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<InstagramAuthService>(InstagramAuthService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('CSRF state generation and verification', () => {
    it('generates and verifies a signed state with admin email', () => {
      const { state, expiresAt } = service.generateOAuthState(
        'Admin@Example.com',
      );
      expect(state).toContain('.');
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

      const payload = service.verifyOAuthState(state);
      expect(payload.email).toBe('admin@example.com');
      expect(payload.nonce).toBeTruthy();
    });

    it('rejects tampered, malformed, or expired state', () => {
      const { state } = service.generateOAuthState('admin@example.com');
      const [payload, sig] = state.split('.');
      const tampered = `${payload}.${sig.slice(0, -1)}X`;

      expect(() => service.verifyOAuthState(tampered)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.verifyOAuthState('not-a-valid-state')).toThrow(
        UnauthorizedException,
      );

      const expired = service.generateOAuthState('admin@example.com', -10);
      expect(() => service.verifyOAuthState(expired.state)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('builds Instagram Business Login authorize URL with required scopes and state', () => {
      const result = service.buildAuthorizeUrl('admin@example.com');
      const parsed = new URL(result.authorizeUrl);

      expect(parsed.origin + parsed.pathname).toBe(
        'https://api.instagram.com/oauth/authorize',
      );
      expect(parsed.searchParams.get('client_id')).toBe('meta-app-123');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://admin.example.com/admin/instagram/oauth/callback',
      );
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe(
        'instagram_business_basic,instagram_business_manage_insights',
      );
      expect(parsed.searchParams.get('state')).toBe(result.state);
    });
  });

  describe('handleOAuthCallback', () => {
    it('exchanges code -> short-lived -> long-lived -> /me, encrypts token, and returns zero-token status', async () => {
      const { state } = service.generateOAuthState('admin@example.com');
      const shortToken = 'IG_SHORT_TOKEN_SECRET';
      const longToken = 'IG_LONG_LIVED_TOKEN_SECRET';

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: shortToken,
            user_id: '17841400000001',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: longToken,
            token_type: 'bearer',
            expires_in: 5184000,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            user_id: '17841400000001',
            username: 'ezvibesnc',
            account_type: 'BUSINESS',
          }),
        } as Response);

      const status = await service.handleOAuthCallback('auth-code-xyz', state);

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        'https://api.instagram.com/oauth/access_token',
      );
      expect(String(fetchSpy.mock.calls[1][0])).toContain(
        'https://graph.instagram.com/access_token?grant_type=ig_exchange_token',
      );
      expect(String(fetchSpy.mock.calls[2][0])).toContain(
        'https://graph.instagram.com/me?',
      );

      expect(status.connected).toBe(true);
      expect(status.status).toBe('connected');
      expect(status.instagramUserId).toBe('17841400000001');
      expect(status.username).toBe('ezvibesnc');
      expect(status.accountType).toBe('BUSINESS');
      expect(status.scopes).toEqual([
        'instagram_business_basic',
        'instagram_business_manage_insights',
      ]);

      // Zero token exposure in returned status
      const serialized = JSON.stringify(status);
      expect(serialized).not.toContain(shortToken);
      expect(serialized).not.toContain(longToken);
      expect((status as any).accessToken).toBeUndefined();
      expect((status as any).accessTokenEncrypted).toBeUndefined();

      // Stored entity has encrypted ciphertext that decrypts to longToken
      expect(storedConnections).toHaveLength(1);
      expect(storedConnections[0].accessTokenEncrypted).toBeTruthy();
      expect(storedConnections[0].accessTokenEncrypted).not.toBe(longToken);
      expect(
        decryptInstagramToken(
          storedConnections[0].accessTokenEncrypted!,
          encryptionKey,
        ),
      ).toBe(longToken);
    });

    it('rejects callback when code is missing', async () => {
      const { state } = service.generateOAuthState('admin@example.com');
      await expect(service.handleOAuthCallback('', state)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refreshAccessToken, getStatus, and disconnect', () => {
    it('refreshes long-lived token and re-encrypts without exposing plaintext', async () => {
      const oldToken = 'IG_OLD_LONG_TOKEN';
      const newToken = 'IG_NEW_REFRESHED_TOKEN';
      storedConnections.push({
        id: 'conn-uuid-1',
        instagramUserId: '17841400000001',
        username: 'ezvibesnc',
        accountType: 'BUSINESS',
        scopes: ['instagram_business_basic', 'instagram_business_manage_insights'],
        accessTokenEncrypted: encryptInstagramToken(oldToken, encryptionKey),
        tokenExpiresAt: new Date(Date.now() + 86400 * 1000),
        lastRefreshedAt: new Date(),
        status: 'connected',
        connectedAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: newToken,
          token_type: 'bearer',
          expires_in: 5184000,
        }),
      } as Response);

      const status = await service.refreshAccessToken();
      expect(String(fetchSpy.mock.calls[0][0])).toContain(
        'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token',
      );
      expect(status.connected).toBe(true);
      expect(JSON.stringify(status)).not.toContain(oldToken);
      expect(JSON.stringify(status)).not.toContain(newToken);
      expect(
        decryptInstagramToken(
          storedConnections[0].accessTokenEncrypted!,
          encryptionKey,
        ),
      ).toBe(newToken);
    });

    it('returns disconnected status when no connection exists', async () => {
      const status = await service.getStatus();
      expect(status.connected).toBe(false);
      expect(status.status).toBe('disconnected');
      expect(status.instagramUserId).toBeNull();
    });

    it('disconnects by clearing ciphertext and marking status revoked', async () => {
      storedConnections.push({
        id: 'conn-uuid-1',
        instagramUserId: '17841400000001',
        username: 'ezvibesnc',
        accountType: 'BUSINESS',
        scopes: ['instagram_business_basic'],
        accessTokenEncrypted: encryptInstagramToken('IG_SECRET', encryptionKey),
        tokenExpiresAt: new Date(Date.now() + 86400 * 1000),
        lastRefreshedAt: new Date(),
        status: 'connected',
        connectedAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const status = await service.disconnect();
      expect(status.connected).toBe(false);
      expect(status.status).toBe('revoked');
      expect(status.revokedAt).toBeTruthy();
      expect(storedConnections[0].accessTokenEncrypted).toBeNull();
      expect(storedConnections[0].status).toBe('revoked');
    });
  });
});
