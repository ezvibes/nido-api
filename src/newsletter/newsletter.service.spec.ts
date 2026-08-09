import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NewsletterService } from './newsletter.service';
import { Concert, ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
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
      if (key === 'GEMINI_MODEL') return 'gemini-1.5-flash';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
    it('should substitute placeholders in prompt template', async () => {
      const prompt = await service.buildPrompt({
        dateRange: 'Tuesday, Aug 11 - Sunday, Aug 16, 2026',
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

  describe('fetchNCConcerts and generateNewsletter', () => {
    it('should retrieve database concerts and filter by genre and NC locations', async () => {
      const mockConcerts = [
        {
          title: 'Dr. Bacon Live',
          startsAt: new Date('2026-08-12T20:00:00Z'),
          genre: 'Funk-Rock',
          catalogStatus: ConcertCatalogStatus.ACTIVE,
          isAdminApproved: true,
          isTopPick: true,
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
          title: 'Unrelated NYC Concert',
          startsAt: new Date('2026-08-13T20:00:00Z'),
          genre: 'Electronic',
          catalogStatus: ConcertCatalogStatus.ACTIVE,
          isAdminApproved: true,
          venue: {
            name: 'Brooklyn Bowl',
            city: 'Brooklyn',
            region: 'NY',
          },
        },
      ];

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

      // Raleigh NC concert matches NC check, NYC concert is filtered out
      expect(mockConcertRepository.find).toHaveBeenCalled();
      expect(response.concertsCount).toBe(1);
      expect(response.concerts[0].title).toBe('Dr. Bacon Live');
      expect(response.concerts[0].isPartnerArtist).toBe(true);
      expect(response.newsletterDraft).toBe('Mocked generated newsletter Markdown content from Gemini');
    });
  });

  describe('parseCalendarData', () => {
    it('should parse raw ICS calendar events and filter by target city/genre', async () => {
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
DESCRIPTION:Alt country show in Georgia
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

      // event-1 matches Raleigh NC and target genres (Jam/Funk/Rock). event-2 (GA) is filtered out.
      expect(response.concertsCount).toBe(1);
      expect(response.concerts[0].title).toBe('Dr. Bacon Show');
      expect(response.concerts[0].venue).toBe('The Pour House, Raleigh, NC');
      expect(response.concerts[0].isPartnerArtist).toBe(true);
    });
  });
});
