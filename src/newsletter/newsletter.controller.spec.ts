import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { BeehiivService } from './beehiiv.service';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

describe('NewsletterController', () => {
  let controller: NewsletterController;

  const mockNewsletterService = {
    generateNewsletter: jest.fn(),
    previewNewsletterSources: jest.fn(),
  };

  const mockBeehiivService = {
    createDraftFromHtml: jest.fn(),
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

      expect(mockNewsletterService.generateNewsletter).toHaveBeenCalledWith(dto);
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

      mockNewsletterService.previewNewsletterSources.mockResolvedValue(mockResult);

      const result = await controller.previewSources(dto);

      expect(mockNewsletterService.previewNewsletterSources).toHaveBeenCalledWith(dto);
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

      mockBeehiivService.createDraftFromHtml.mockResolvedValue(mockBeehiivResult);

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
});
