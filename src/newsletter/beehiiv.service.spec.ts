import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BeehiivService } from './beehiiv.service';

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
});
