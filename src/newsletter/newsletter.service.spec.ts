import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NewsletterService } from './newsletter.service';
import { BeehiivService } from './beehiiv.service';
import { Concert, ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: mockGetGenerativeModel,
      };
    }),
  };
});

describe('NewsletterService', () => {
  let service: NewsletterService;

  const mockConcertRepository = {
    find: jest.fn(),
  };

  const mockBeehiivService = {
    createDraftFromHtml: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-key';
      if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        {
          provide: getRepositoryToken(Concert),
          useValue: mockConcertRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: BeehiivService,
          useValue: mockBeehiivService,
        },
      ],
    }).compile();

    service = module.get<NewsletterService>(NewsletterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildPrompt', () => {
    it('should substitute placeholders in prompt template for weekly edition', async () => {
      const prompt = await service.buildPrompt({
        dateRange: 'Tuesday, Aug 11 - Sunday, Aug 16, 2026',
        editionType: 'weekly',
        recapNotes: 'Evan played a gig.',
        featuredShow: 'Dr. Bacon at Pour House',
        featuredFestival: 'Grassroots Festival',
        rawCalendarData: '[]',
      });

      expect(prompt).toContain('Tuesday, Aug 11 - Sunday, Aug 16, 2026');
      expect(prompt).toContain('Evan played a gig.');
      expect(prompt).toContain('Dr. Bacon at Pour House');
      expect(prompt).toContain('Grassroots Festival');
    });
  });

  describe('previewNewsletterSources', () => {
    it('should query DB and return preview concerts without invoking Gemini', async () => {
      const mockConcerts = [
        {
          id: 'concert-1',
          title: 'SunSquabi Live',
          startsAt: new Date('2026-09-11T20:00:00Z'),
          genre: 'Electronic Funk',
          catalogStatus: ConcertCatalogStatus.ACTIVE,
          venue: {
            name: 'Lincoln Theatre',
            city: 'Raleigh',
            region: 'NC',
          },
          lineup: [{ band: { name: 'SunSquabi' } }],
        },
      ];

      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      const result = await service.previewNewsletterSources({
        startDate: '2026-09-08T00:00:00.000Z',
        endDate: '2026-09-13T23:59:59.999Z',
      });

      expect(mockConcertRepository.find).toHaveBeenCalledTimes(1);
      expect(result.concerts).toHaveLength(1);
      expect(result.concerts[0].title).toBe('SunSquabi Live');
      expect(result.concerts[0].venue).toContain('Lincoln Theatre');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('generateNewsletter', () => {
    const mockConcerts = [
      {
        id: 'concert-1',
        title: 'Papadosio Live',
        startsAt: new Date('2026-09-11T20:00:00Z'),
        genre: 'Funk-Rock',
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        venue: {
          name: 'Lincoln Theatre',
          city: 'Raleigh',
          region: 'NC',
        },
        lineup: [{ band: { name: 'Papadosio' } }],
      },
    ];

    it('should generate newsletter draft and auto-push to Beehiiv when autoPushToBeehiiv is true', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '# EZ Vibes Weekly Top Picks\n\n## Quick Hits\n- Papadosio at Lincoln Theatre',
        },
      });

      mockBeehiivService.createDraftFromHtml.mockResolvedValue({
        id: 'post_beehiiv_123',
        title: 'EZ Vibes Top Picks: Tuesday, Sep 8 - Sunday, Sep 13, 2026',
        status: 'draft',
        web_url: 'https://beehiiv.com/posts/post_beehiiv_123',
      });

      const result = await service.generateNewsletter({
        startDate: '2026-09-08T00:00:00.000Z',
        endDate: '2026-09-13T23:59:59.999Z',
        editionType: 'weekly',
        autoPushToBeehiiv: true,
      });

      expect(result.newsletterDraft).toContain('# EZ Vibes Weekly Top Picks');
      expect(result.beehiivDraft).toBeDefined();
      expect(result.beehiivDraft?.id).toBe('post_beehiiv_123');
      expect(mockBeehiivService.createDraftFromHtml).toHaveBeenCalled();
    });
  });
});
