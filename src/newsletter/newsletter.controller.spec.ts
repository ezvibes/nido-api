import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';

describe('NewsletterController', () => {
  let controller: NewsletterController;
  let service: NewsletterService;

  const mockNewsletterService = {
    generateNewsletter: jest.fn(),
    previewNewsletterSources: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockAdminGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController],
      providers: [
        {
          provide: NewsletterService,
          useValue: mockNewsletterService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(AdminEmailGuard)
      .useValue(mockAdminGuard)
      .compile();

    controller = module.get<NewsletterController>(NewsletterController);
    service = module.get<NewsletterService>(NewsletterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateWeekly', () => {
    it('should call service generateNewsletter method', async () => {
      const dto = {
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        weekendRecap: 'Recap notes.',
      };

      const expectedResponse = {
        newsletterDraft: 'Markdown output',
        concertsCount: 0,
        concerts: [],
      };

      mockNewsletterService.generateNewsletter.mockResolvedValue(expectedResponse);

      const result = await controller.generateWeekly(dto);

      expect(service.generateNewsletter).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
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

      expect(service.previewNewsletterSources).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
