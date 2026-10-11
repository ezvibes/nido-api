import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BeehiivMcpService } from './beehiiv-mcp.service';

jest.mock('lodash-es', () => {
  const lodash: unknown = jest.requireActual('lodash');
  return lodash;
});

describe('BeehiivMcpService', () => {
  let service: BeehiivMcpService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'BEEHIIV_API_KEY') return 'test-key';
        if (key === 'BEEHIIV_PUBLICATION_ID') return 'pub_test';
        if (key === 'BEEHIIV_MOCK_STAGING') return 'true';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeehiivMcpService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BeehiivMcpService>(BeehiivMcpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should stage draft via mock mode when BEEHIIV_MOCK_STAGING is true', async () => {
    const result = await service.stageDraftViaMcp({
      title: 'Top Picks Mock',
      content_html: '<p>Sample Draft</p>',
      subtitle: 'Weekend Preview',
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('draft');
    expect(result.title).toBe('Top Picks Mock');
    expect(result.id).toContain('mock_mcp_post_');
    expect(result.web_url).toContain('beehiiv.com/posts/mock_');
  });

  it('should fallback gracefully when MCP toolset is not initialized', async () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'BEEHIIV_MOCK_STAGING') return 'false';
      if (key === 'BEEHIIV_API_KEY') return '';
      return undefined;
    });

    const result = await service.stageDraftViaMcp({
      title: 'Fallback Draft',
      content_html: '<p>Fallback</p>',
    });

    expect(result.status).toBe('draft');
    expect(result.id).toContain('local_staged_');
  });
});
