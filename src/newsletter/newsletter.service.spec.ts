import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NewsletterService } from './newsletter.service';
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

    it('should format title header for monthly edition', async () => {
      const prompt = await service.buildPrompt({
        dateRange: 'September 2026',
        editionType: 'monthly',
        recapNotes: 'Fall lineup preview.',
        rawCalendarData: '[]',
      });

      expect(prompt).toContain('# EZ Vibes Monthly Top Picks: September 2026');
    });
  });

  describe('fetchNCConcerts and generateNewsletter', () => {
    const mockConcerts = [
      {
        id: 'concert-1',
        title: 'Dr. Bacon Live',
        startsAt: new Date('2026-08-12T20:00:00Z'),
        genre: 'Funk-Rock',
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        isAdminApproved: true,
        isTopPick: true,
        isFeatured: true,
        topPickScore: 0.9,
        venue: {
          name: 'The Pour House Music Hall',
          city: 'Raleigh',
          region: 'NC',
        },
        lineup: [
          {
            band: {
              name: 'Dr. Bacon',
            },
          },
        ],
      },
      {
        id: 'concert-2',
        title: 'Pop Indie Show',
        startsAt: new Date('2026-08-13T20:00:00Z'),
        genre: 'Indie Pop',
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        isAdminApproved: true,
        isTopPick: false,
        isFeatured: false,
        venue: {
          name: 'Cat\'s Cradle',
          city: 'Carrboro',
          region: 'NC',
        },
      },
    ];

    it('should include all active approved database concerts by default', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Mocked generated newsletter Markdown content from Gemini',
        },
      });

      const response = await service.generateNewsletter({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        weekendRecap: 'Weekend was wild.',
        useDatabase: true,
      });

      // By default (strictFiltering = false), both active approved DB concerts are included
      expect(mockConcertRepository.find).toHaveBeenCalled();
      expect(response.concertsCount).toBe(2);
      expect(response.newsletterDraft).toBe('Mocked generated newsletter Markdown content from Gemini');
    });

    it('should preview the same database concerts without calling Gemini', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      const response = await service.previewNewsletterSources({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        dateRangeLabel: 'Aug 11-16',
        useDatabase: true,
      });

      expect(response).toMatchObject({
        dateRangeLabel: 'Aug 11-16',
        concertsCount: 2,
        calendarEventsCount: 0,
        totalCount: 2,
      });
      expect(response.concerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'concert-1',
            title: 'Dr. Bacon Live',
            source: 'Nido Concert Database',
          }),
        ]),
      );
      expect(mockGetGenerativeModel).not.toHaveBeenCalled();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should filter by specific city when cities filter is provided', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Filtered city newsletter draft',
        },
      });

      const response = await service.generateNewsletter({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        cities: ['Raleigh'],
        useDatabase: true,
      });

      expect(response.concertsCount).toBe(1);
    });

    it('should preview only Featured database concerts when requested', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      const response = await service.previewNewsletterSources({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        featuredOnly: true,
        useDatabase: true,
      });

      expect(response.concerts).toEqual([
        expect.objectContaining({
          id: 'concert-1',
          title: 'Dr. Bacon Live',
        }),
      ]);
      expect(response.totalCount).toBe(1);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should preview only Top Pick database concerts when requested', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      const response = await service.previewNewsletterSources({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        topPicksOnly: true,
        useDatabase: true,
      });

      expect(response.concerts).toEqual([
        expect.objectContaining({
          id: 'concert-1',
          title: 'Dr. Bacon Live',
        }),
      ]);
      expect(response.totalCount).toBe(1);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should exclude selected database concerts from preview and generation', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Curated newsletter draft',
        },
      });

      const params = {
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        excludeConcertIds: ['concert-2'],
        useDatabase: true,
      };
      const preview = await service.previewNewsletterSources(params);
      const generated = await service.generateNewsletter(params);

      expect(preview.concerts).toEqual([
        expect.objectContaining({
          id: 'concert-1',
          title: 'Dr. Bacon Live',
        }),
      ]);
      expect(preview.totalCount).toBe(1);
      expect(generated.concertsCount).toBe(preview.totalCount);
    });

    it('should enforce legacy strict city and genre rules when strictFiltering is true', async () => {
      mockConcertRepository.find.mockResolvedValue(mockConcerts);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Strict filtered newsletter draft',
        },
      });

      const response = await service.generateNewsletter({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        strictFiltering: true,
        useDatabase: true,
      });

      // Raleigh NC Funk-Rock matches; Carrboro NC Indie Pop is filtered out by strict rules
      expect(response.concertsCount).toBe(1);
    });
  });

  describe('parseCalendarData', () => {
    it('should parse raw ICS calendar events and include all events within the date range', async () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Dr. Bacon Show
DESCRIPTION:Amazing Jam Funk Rock show
LOCATION:The Pour House, Raleigh, NC
DTSTART:20260812T200000Z
DTEND:20260812T230000Z
END:VEVENT
BEGIN:VEVENT
UID:event-2
SUMMARY:Some Other Show
DESCRIPTION:Custom curated show
LOCATION:Eddie's Attic, Decatur, GA
DTSTART:20260814T200000Z
DTEND:20260814T230000Z
END:VEVENT
END:VCALENDAR`;

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Weekly picks draft',
        },
      });

      const response = await service.generateNewsletter({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        rawCalendarData: icsData,
        useDatabase: false,
      });

      // Both in-range ICS events (event-1 and event-2) are included without getting dropped by hardcoded filters
      expect(response.concertsCount).toBe(2);
    });

    it('should preview parsed calendar events and align with generation count', async () => {
      const jsonData = JSON.stringify([
        {
          title: 'Preview Show',
          date: '2026-08-12T20:00:00Z',
          venue: 'The Pour House',
        },
      ]);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Weekly picks draft',
        },
      });

      const preview = await service.previewNewsletterSources({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        rawCalendarData: jsonData,
        useDatabase: false,
      });
      const generated = await service.generateNewsletter({
        startDate: '2026-08-11T00:00:00Z',
        endDate: '2026-08-16T23:59:59Z',
        rawCalendarData: jsonData,
        useDatabase: false,
      });

      expect(preview.calendarEvents).toEqual([
        expect.objectContaining({
          title: 'Preview Show',
          source: 'Calendar Feed (JSON)',
        }),
      ]);
      expect(preview.totalCount).toBe(1);
      expect(generated.concertsCount).toBe(preview.totalCount);
    });
  });
});
