import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramMediaService } from './instagram-media.service';

describe('InstagramMediaService', () => {
  let service: InstagramMediaService;
  let fetchSpy: jest.SpyInstance;

  const mockAuthService = {
    getValidAccessToken: jest.fn(async () => ({
      accessToken: 'FB_VALID_SECRET_TOKEN',
      instagramUserId: '17841400000001',
      connectionId: 'conn-uuid-1',
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramMediaService,
        {
          provide: InstagramAuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<InstagramMediaService>(InstagramMediaService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('listOwnMedia', () => {
    it('queries graph.facebook.com/v21.0/{igUserId}/media, bounds limit to <= 25, and normalizes items', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'media-1',
              caption: 'Live at Cat Cradle',
              media_type: 'IMAGE',
              media_url: 'https://cdn.example.com/1.jpg',
              permalink: 'https://www.instagram.com/p/abc/',
              timestamp: '2026-11-20T18:00:00+0000',
              like_count: 42,
              comments_count: 5,
            },
          ],
        }),
      } as Response);

      const items = await service.listOwnMedia(100);
      const calledUrl = String(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain(
        'https://graph.facebook.com/v21.0/17841400000001/media?',
      );
      expect(calledUrl).toContain('limit=25');
      expect(items).toEqual([
        {
          id: 'media-1',
          caption: 'Live at Cat Cradle',
          mediaType: 'IMAGE',
          mediaUrl: 'https://cdn.example.com/1.jpg',
          thumbnailUrl: null,
          permalink: 'https://www.instagram.com/p/abc/',
          timestamp: '2026-11-20T18:00:00+0000',
          likeCount: 42,
          commentsCount: 5,
        },
      ]);
    });

    it('clamps non-positive limit to 1', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      const items = await service.listOwnMedia(0);
      expect(String(fetchSpy.mock.calls[0][0])).toContain('limit=1');
      expect(items).toEqual([]);
    });
  });

  describe('getMediaInsights', () => {
    it('queries graph.facebook.com/v21.0/{mediaId}/insights and normalizes missing metrics to unavailable', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'media-1', media_type: 'IMAGE' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { name: 'reach', values: [{ value: 1200 }] },
              { name: 'likes', values: [{ value: 85 }] },
              { name: 'comments', values: [{ value: 7 }] },
              { name: 'saved', values: [{ value: 14 }] },
              { name: 'total_interactions', values: [{ value: 106 }] },
            ],
          }),
        } as Response);

      const insights = await service.getMediaInsights('media-1');
      expect(String(fetchSpy.mock.calls[0][0])).toContain(
        'https://graph.facebook.com/v21.0/media-1?',
      );
      expect(String(fetchSpy.mock.calls[1][0])).toContain(
        'https://graph.facebook.com/v21.0/media-1/insights?',
      );
      expect(insights.mediaId).toBe('media-1');
      expect(insights.mediaType).toBe('IMAGE');
      expect(insights.reach).toBe(1200);
      expect(insights.likes).toBe(85);
      expect(insights.impressions).toBe('unavailable');
      expect(insights.plays).toBe('unavailable');
      expect(insights.shares).toBe('unavailable');
      expect(insights.unavailableMetrics).toEqual([
        'impressions',
        'shares',
        'plays',
      ]);
    });

    it('normalizes all metrics to unavailable when Graph API returns 400 unsupported metric error', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'media-2', media_type: 'CAROUSEL_ALBUM' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: 100,
              message:
                'Unsupported get request. Metric plays is not supported.',
            },
          }),
        } as Response);

      const insights = await service.getMediaInsights('media-2');
      expect(insights.reach).toBe('unavailable');
      expect(insights.plays).toBe('unavailable');
      expect(insights.unavailableMetrics).toHaveLength(8);
    });

    it('throws UnauthorizedException on 401 from Graph API', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'media-1', media_type: 'IMAGE' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: { message: 'Invalid OAuth access token.' },
          }),
        } as Response);

      await expect(service.getMediaInsights('media-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
