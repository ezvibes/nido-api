import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BeehiivService } from './beehiiv.service';
import { NewsletterController } from './newsletter.controller';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('BeehiivService', () => {
  let service: BeehiivService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BEEHIIV_API_KEY') return 'test-beehiiv-key';
      if (key === 'BEEHIIV_PUBLICATION_ID') return 'pub_12345';
      if (key === 'BEEHIIV_POST_TEMPLATE_ID') return 'tpl_67890';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'BEEHIIV_API_KEY') return 'test-beehiiv-key';
      if (key === 'BEEHIIV_PUBLICATION_ID') return 'pub_12345';
      if (key === 'BEEHIIV_POST_TEMPLATE_ID') return 'tpl_67890';
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeehiivService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BeehiivService>(BeehiivService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDraftFromHtml', () => {
    it('should throw Error if BEEHIIV_API_KEY is missing', async () => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue(null);

      await expect(
        service.createDraftFromHtml({
          title: 'Test Title',
          htmlContent: '<p>Test</p>',
        }),
      ).rejects.toThrow('BEEHIIV_API_KEY is not configured');
    });

    it('should send POST request to Beehiiv v2 publications endpoint with html block format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'post_beehiiv_abc123',
            title: 'EZ Vibes Top Picks: Sep 10 - Sep 15, 2026',
            status: 'draft',
            web_url: 'https://beehiiv.com/posts/post_beehiiv_abc123',
          },
        }),
      });

      const result = await service.createDraftFromHtml({
        title: 'EZ Vibes Top Picks: Sep 10 - Sep 15, 2026',
        htmlContent:
          '<h1>Weekly Top Picks</h1><p>Check out Papadosio live!</p>',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.beehiiv.com/v2/publications/pub_12345/posts',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-beehiiv-key',
          },
        }),
      );

      const fetchCallArgs = mockFetch.mock.calls[0][1];
      const parsedBody = JSON.parse(fetchCallArgs.body);
      expect(parsedBody).toEqual({
        title: 'EZ Vibes Top Picks: Sep 10 - Sep 15, 2026',
        post_template_id: 'tpl_67890',
        status: 'draft',
        body_content:
          '<h1>Weekly Top Picks</h1><p>Check out Papadosio live!</p>',
        blocks: [
          {
            type: 'html',
            html: '<h1>Weekly Top Picks</h1><p>Check out Papadosio live!</p>',
          },
        ],
      });

      expect(result.id).toBe('post_beehiiv_abc123');
      expect(result.edit_url).toBe(
        'https://app.beehiiv.com/posts/beehiiv_abc123/edit',
      );
      expect(result.status).toBe('draft');
    });

    it('should handle Beehiiv API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () =>
          JSON.stringify({
            errors: [{ message: 'Invalid template ID specified' }],
          }),
      });

      await expect(
        service.createDraftFromHtml({
          title: 'Test Title',
          htmlContent: '<p>Test</p>',
        }),
      ).rejects.toThrow('Beehiiv API error (422)');
    });
  });

  describe('getPost', () => {
    it('should fetch published post content from Beehiiv v2 publications endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'post_123',
            title: 'Published Weekly Top Picks',
            status: 'confirmed',
            content: { free: { web: '<p>Published copy</p>' } },
          },
        }),
      });

      const result = await service.getPost('post_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.beehiiv.com/v2/publications/pub_12345/posts/post_123?expand[]=free_web_content',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-beehiiv-key',
          }),
        }),
      );
      expect(result.id).toBe('post_123');
      expect(result.status).toBe('confirmed');
    });
  });

  describe('getPostStats', () => {
    it('should fetch post stats and link click records', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'post_123',
            stats: {
              open_rate: 0.48,
              click_rate: 0.14,
              total_clicks: 120,
              links: [
                {
                  url: 'https://etix.com/tickets/1',
                  clicks: 50,
                  unique_clicks: 45,
                },
              ],
            },
          },
        }),
      });

      const result = await service.getPostStats('post_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.beehiiv.com/v2/publications/pub_12345/posts/post_123?expand[]=stats',
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result.id).toBe('post_123');
      expect(result.total_clicks).toBe(120);
      expect(result.links).toHaveLength(1);
    });
  });

  describe('subscribeEmail', () => {
    it('subscribes email to Beehiiv v2 subscriptions endpoint when credentials are configured', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'sub_123', status: 'active' } }),
      });

      const result = await service.subscribeEmail({
        email: ' Fan@Example.com ',
        utmSource: 'nido_concert_detail',
        utmCampaign: 'weekly_top_picks',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.beehiiv.com/v2/publications/pub_12345/subscriptions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-beehiiv-key',
          },
        }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        email: 'fan@example.com',
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: 'nido_concert_detail',
        utm_medium: 'organic',
        utm_campaign: 'weekly_top_picks',
      });
      expect(result).toEqual({
        subscribed: true,
        status: 'active',
        subscriptionId: 'sub_123',
      });
    });

    it('rejects with InternalServerErrorException if Beehiiv 200 response is missing a confirmed subscription ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await expect(
        service.subscribeEmail({
          email: 'fan@example.com',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('rejects with ServiceUnavailableException when Beehiiv credentials are missing so unpersisted signups are never confirmed', async () => {
      mockConfigService.get.mockReturnValue(null);

      await expect(
        service.subscribeEmail({
          email: 'local@example.com',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('NewsletterController.subscribe abuse protection', () => {
    it('rejects honeypot bot submissions and rate-limits repeated attempts from the same IP', async () => {
      const mockSubscribe = jest.fn().mockResolvedValue({
        subscribed: true,
        status: 'active',
        subscriptionId: 'sub_123',
      });
      const controller = new NewsletterController(
        {} as any,
        { subscribeEmail: mockSubscribe } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(
        controller.subscribe(
          { email: 'bot@example.com', website: 'https://spam.invalid' },
          { ip: '203.0.113.10' } as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockSubscribe).not.toHaveBeenCalled();

      for (let i = 0; i < 5; i += 1) {
        await controller.subscribe({ email: `fan${i}@example.com` }, {
          ip: '203.0.113.55',
        } as any);
      }
      expect(mockSubscribe).toHaveBeenCalledTimes(5);

      await expect(
        controller.subscribe({ email: 'fan6@example.com' }, {
          ip: '203.0.113.55',
        } as any),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      controller.resetSubscribeRateLimits();
    });
  });
});
