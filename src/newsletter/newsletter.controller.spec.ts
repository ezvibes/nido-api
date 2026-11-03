import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { BeehiivService } from './beehiiv.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

describe('NewsletterController', () => {
  let controller: NewsletterController;

  const mockNewsletterService = {
    generateNewsletter: jest.fn(),
    previewNewsletterSources: jest.fn(),
    convertMarkdownToHtml: jest.fn((text: string) => text),
  };

  const mockBeehiivService = {
    createDraftFromHtml: jest.fn(),
    getPost: jest.fn(),
    getPostStats: jest.fn(),
  };

  const mockAuditorService = {
    auditDistribution: jest.fn(),
  };

  const mockHarvesterService = {
    extractSupportActs: jest.fn(),
    parseFestivalLineup: jest.fn(),
    processDiscoveredArtists: jest.fn(),
  };

  const mockFeedbackService = {
    diffDraftVsPublished: jest.fn(),
    calculateEngagementAffinities: jest.fn(),
  };

  const mockAuthService = {
    verifyIdToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController],
      providers: [
        {
          provide: NewsletterService,
          useValue: mockNewsletterService,
        },
        {
          provide: BeehiivService,
          useValue: mockBeehiivService,
        },
        {
          provide: NewsletterDistributionAuditorService,
          useValue: mockAuditorService,
        },
        {
          provide: NewsletterLineupHarvesterService,
          useValue: mockHarvesterService,
        },
        {
          provide: NewsletterFeedbackLoopService,
          useValue: mockFeedbackService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<NewsletterController>(NewsletterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateWeekly', () => {
    it('should delegate generation to NewsletterService', async () => {
      const dto = { editionType: 'weekly' as any };
      const mockResult = {
        newsletterDraft: '# Draft',
        concertsCount: 5,
      };

      mockNewsletterService.generateNewsletter.mockResolvedValue(mockResult);

      const result = await controller.generateWeekly(dto);

      expect(mockNewsletterService.generateNewsletter).toHaveBeenCalledWith(
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('previewSources', () => {
    it('should delegate source preview to NewsletterService', async () => {
      const dto = { editionType: 'weekly' as any };
      const mockResult = {
        dateRangeLabel: 'Tuesday, Sep 8 - Sunday, Sep 13, 2026',
        concerts: [],
        calendarEvents: [],
        concertsCount: 0,
        calendarEventsCount: 0,
        totalCount: 0,
      };

      mockNewsletterService.previewNewsletterSources.mockResolvedValue(
        mockResult,
      );

      const result = await controller.previewSources(dto);

      expect(
        mockNewsletterService.previewNewsletterSources,
      ).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('pushBeehiivDraft', () => {
    it('should delegate draft creation to BeehiivService', async () => {
      const dto = {
        title: 'EZ Vibes Top Picks',
        htmlContent: '<p>HTML content</p>',
        postTemplateId: 'tpl_123',
      };

      const mockBeehiivResult = {
        id: 'post_123',
        title: 'EZ Vibes Top Picks',
        status: 'draft',
      };

      mockBeehiivService.createDraftFromHtml.mockResolvedValue(
        mockBeehiivResult,
      );

      const result = await controller.pushBeehiivDraft(dto);

      expect(mockBeehiivService.createDraftFromHtml).toHaveBeenCalledWith({
        title: dto.title,
        htmlContent: dto.htmlContent,
        postTemplateId: dto.postTemplateId,
        publicationId: undefined,
      });
      expect(result).toEqual(mockBeehiivResult);
    });
  });

  describe('previewSources', () => {
    it('should call service previewNewsletterSources method', async () => {
      const dto = {
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
      };

      const expectedResponse = {
        dateRangeLabel: 'Tuesday, Aug 11 - Sunday, Aug 16, 2026',
        concerts: [],
        calendarEvents: [],
        concertsCount: 0,
        calendarEventsCount: 0,
        totalCount: 0,
      };

      mockNewsletterService.previewNewsletterSources.mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.previewSources(dto);

      expect(
        mockNewsletterService.previewNewsletterSources,
      ).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('auditDistribution', () => {
    it('should invoke auditorService.auditDistribution', async () => {
      const dto = {
        events: [
          {
            artistName: 'Big Something',
            venueName: 'Lincoln Theatre',
            city: 'Raleigh',
            genres: ['Jam'],
          },
        ],
      };
      const mockReport = { totalEvents: 1, isBalanced: false };
      mockAuditorService.auditDistribution.mockReturnValue(mockReport);

      const result = await controller.auditDistribution(dto as any);
      expect(mockAuditorService.auditDistribution).toHaveBeenCalledWith(
        dto.events,
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe('harvestLineup', () => {
    it('should harvest support acts from concert title', async () => {
      const dto = {
        sourceType: 'support_act' as any,
        rawText: 'Big Something w/ The Fritz',
        autoCreateInDb: false,
      };
      mockHarvesterService.extractSupportActs.mockReturnValue({
        headliner: 'Big Something',
        supportingActs: ['The Fritz'],
      });
      mockHarvesterService.processDiscoveredArtists.mockResolvedValue({
        totalExtracted: 2,
        newDiscoveriesCount: 1,
      });

      const result = await controller.harvestLineup(dto);
      expect(mockHarvesterService.extractSupportActs).toHaveBeenCalledWith(
        dto.rawText,
      );
      expect(mockHarvesterService.processDiscoveredArtists).toHaveBeenCalledWith(
        ['Big Something', 'The Fritz'],
        'support_act',
        undefined,
        false,
      );
      expect(result).toEqual({ totalExtracted: 2, newDiscoveriesCount: 1 });
    });

    it('should harvest festival lineup', async () => {
      const dto = {
        sourceType: 'festival_lineup' as any,
        rawText: 'Bela Fleck, Billy Strings, Sierra Hull',
        sourceTitle: 'MerleFest',
        autoCreateInDb: true,
      };
      mockHarvesterService.parseFestivalLineup.mockReturnValue([
        'Bela Fleck',
        'Billy Strings',
        'Sierra Hull',
      ]);
      mockHarvesterService.processDiscoveredArtists.mockResolvedValue({
        totalExtracted: 3,
        newDiscoveriesCount: 1,
      });

      const result = await controller.harvestLineup(dto);
      expect(mockHarvesterService.parseFestivalLineup).toHaveBeenCalledWith(
        dto.rawText,
      );
      expect(mockHarvesterService.processDiscoveredArtists).toHaveBeenCalledWith(
        ['Bela Fleck', 'Billy Strings', 'Sierra Hull'],
        'festival_lineup',
        'MerleFest',
        true,
      );
      expect(result).toEqual({ totalExtracted: 3, newDiscoveriesCount: 1 });
    });
  });

  describe('diffDraftVsPublished', () => {
    it('should fetch published post and run diff comparison', async () => {
      const dto = {
        postId: 'post_abc',
        draftContent: 'Draft copy',
        publicationId: 'pub_xyz',
      };
      mockBeehiivService.getPost.mockResolvedValue({
        id: 'post_abc',
        content: { free: { web: '<p>Published copy</p>' } },
      });
      mockFeedbackService.diffDraftVsPublished.mockReturnValue({
        postId: 'post_abc',
        retainedShows: [],
        addedShows: ['Big Something'],
      });

      const result = await controller.diffDraftVsPublished(dto);
      expect(mockBeehiivService.getPost).toHaveBeenCalledWith(
        'post_abc',
        'pub_xyz',
      );
      expect(mockFeedbackService.diffDraftVsPublished).toHaveBeenCalledWith(
        'post_abc',
        'Draft copy',
        '<p>Published copy</p>',
      );
      expect(result).toEqual({
        postId: 'post_abc',
        retainedShows: [],
        addedShows: ['Big Something'],
      });
    });
  });

  describe('getPostFeedbackStats', () => {
    it('should fetch post stats and calculate engagement affinities', async () => {
      const stats = { id: 'post_123', total_clicks: 45, links: [] };
      mockBeehiivService.getPostStats.mockResolvedValue(stats);
      mockFeedbackService.calculateEngagementAffinities.mockReturnValue({
        postId: 'post_123',
        entityAffinities: [],
      });

      const result = await controller.getPostFeedbackStats('post_123');
      expect(mockBeehiivService.getPostStats).toHaveBeenCalledWith('post_123');
      expect(
        mockFeedbackService.calculateEngagementAffinities,
      ).toHaveBeenCalledWith(stats);
      expect(result).toEqual({
        postId: 'post_123',
        entityAffinities: [],
      });
    });
  });
});
