import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import { AdminInstagramController } from './admin-instagram.controller';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramMediaService } from './instagram-media.service';

describe('AdminInstagramController', () => {
  let controller: AdminInstagramController;

  const mockAuthService = {
    getStatus: jest.fn(async () => ({
      connected: true,
      status: 'connected',
      instagramUserId: '17841400000001',
      username: 'ezvibesnc',
      accountType: 'BUSINESS',
      scopes: [
        'instagram_business_basic',
        'instagram_business_manage_insights',
      ],
      tokenExpiresAt: '2026-12-25T00:00:00.000Z',
      lastRefreshedAt: '2026-11-25T00:00:00.000Z',
      connectedAt: '2026-11-25T00:00:00.000Z',
      revokedAt: null,
    })),
    buildAuthorizeUrl: jest.fn(() => ({
      authorizeUrl:
        'https://api.instagram.com/oauth/authorize?client_id=123&state=abc',
      state: 'abc',
      expiresAt: '2026-11-25T00:10:00.000Z',
    })),
    handleOAuthCallback: jest.fn(async () => ({
      connected: true,
      status: 'connected',
      instagramUserId: '17841400000001',
      username: 'ezvibesnc',
      accountType: 'BUSINESS',
      scopes: [
        'instagram_business_basic',
        'instagram_business_manage_insights',
      ],
      tokenExpiresAt: '2026-12-25T00:00:00.000Z',
      lastRefreshedAt: '2026-11-25T00:00:00.000Z',
      connectedAt: '2026-11-25T00:00:00.000Z',
      revokedAt: null,
    })),
    disconnect: jest.fn(async () => ({
      connected: false,
      status: 'revoked',
      instagramUserId: '17841400000001',
      username: 'ezvibesnc',
      accountType: 'BUSINESS',
      scopes: ['instagram_business_basic'],
      tokenExpiresAt: '2026-12-25T00:00:00.000Z',
      lastRefreshedAt: '2026-11-25T00:00:00.000Z',
      connectedAt: '2026-11-25T00:00:00.000Z',
      revokedAt: '2026-11-25T01:00:00.000Z',
    })),
  };

  const mockMediaService = {
    listOwnMedia: jest.fn(async () => []),
    getMediaInsights: jest.fn(async (id: string) => ({
      mediaId: id,
      mediaType: 'IMAGE',
      reach: 100,
      impressions: 'unavailable',
      likes: 10,
      comments: 2,
      shares: 'unavailable',
      saved: 3,
      plays: 'unavailable',
      totalInteractions: 15,
      fetchedAt: '2026-11-25T00:00:00.000Z',
      unavailableMetrics: ['impressions', 'shares', 'plays'],
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInstagramController],
      providers: [
        { provide: InstagramAuthService, useValue: mockAuthService },
        { provide: InstagramMediaService, useValue: mockMediaService },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminEmailGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminInstagramController>(AdminInstagramController);
  });

  it('enforces FirebaseAuthGuard and AdminEmailGuard at controller level', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminInstagramController,
    );
    expect(guards).toEqual([FirebaseAuthGuard, AdminEmailGuard]);
  });

  it('delegates status, oauth/start, oauth/callback, disconnect, media, and insights', async () => {
    const status = await controller.getStatus();
    expect(status.connected).toBe(true);
    expect((status as any).accessToken).toBeUndefined();

    const start = controller.startOAuth({ email: 'admin@example.com' } as any);
    expect(start.authorizeUrl).toContain('api.instagram.com/oauth/authorize');
    expect(mockAuthService.buildAuthorizeUrl).toHaveBeenCalledWith(
      'admin@example.com',
    );

    const callback = await controller.oauthCallback('code-1', 'state-1');
    expect(callback.connected).toBe(true);
    expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith(
      'code-1',
      'state-1',
    );

    const disconnected = await controller.disconnect();
    expect(disconnected.status).toBe('revoked');

    await controller.listMedia('15');
    expect(mockMediaService.listOwnMedia).toHaveBeenCalledWith(15);

    const insights = await controller.getMediaInsights('media-99');
    expect(insights.mediaId).toBe('media-99');
    expect(insights.impressions).toBe('unavailable');
  });

  it('rejects oauth/callback when code or state is missing', async () => {
    await expect(controller.oauthCallback(undefined, 'state-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.oauthCallback('code-1', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});
