import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../apis/concerts/entities/concert.entity';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { ConcertUpload } from '../ingestion/entities/concert-upload.entity';
import { BeehiivService } from './beehiiv.service';
import { NewsletterCatalogService } from './newsletter-catalog.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { WeeklyContentBriefService } from './weekly-content-brief.service';
import { SocialConceptGeneratorService } from './social-concept-generator.service';

describe('WeeklyContentBriefService', () => {
  const findApprovedConcertEntities = jest.fn();
  const findUploads = jest.fn();

  let service: WeeklyContentBriefService;

  const makeConcert = (overrides: Partial<Concert> = {}): Concert =>
    ({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Dr. Bacon at The Pour House',
      genre: 'Funk',
      startsAt: new Date('2026-11-28T01:00:00.000Z'), // 8:00 PM EST on 2026-11-27
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isAdminApproved: true,
      isFeatured: true,
      isTopPick: true,
      description: 'High-energy brass funk night in downtown Raleigh.',
      ticketUrl: 'https://tickets.example.com/dr-bacon',
      venue: {
        id: 'venue-1',
        name: 'The Pour House Music Hall',
        city: 'Raleigh',
        region: 'NC',
      },
      lineup: [
        {
          performanceOrder: 0,
          band: {
            id: 'band-1',
            name: 'Dr. Bacon',
            instagramHandle: 'drbaconmusic',
            promoImageUrl: 'https://cdn.example.com/dr-bacon.jpg',
          },
        },
      ],
      ...overrides,
    }) as unknown as Concert;

  beforeEach(() => {
    jest.clearAllMocks();
    findUploads.mockResolvedValue([]);

    service = new WeeklyContentBriefService(
      {
        findApprovedConcertEntities,
      } as unknown as NewsletterCatalogService,
      {
        find: findUploads,
      } as unknown as Repository<ConcertUpload>,
    );
  });

  it('queries active admin-approved concerts with default limit 8 and filters out unapproved/non-active rows', async () => {
    const approved = makeConcert();
    const unapproved = makeConcert({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Unapproved Show',
      isAdminApproved: false,
    });
    const hidden = makeConcert({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Hidden Show',
      catalogStatus: ConcertCatalogStatus.HIDDEN,
    });

    findApprovedConcertEntities.mockResolvedValue([
      approved,
      unapproved,
      hidden,
    ]);
    findUploads.mockResolvedValue([
      {
        id: 'upload-1',
        concertId: approved.id,
      },
    ]);

    const brief = await service.generateBrief({
      campaignTheme: 'Funk',
    });

    expect(findApprovedConcertEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 8,
        start: expect.any(Date),
        end: expect.any(Date),
      }),
    );
    expect(brief.limit).toBe(8);
    expect(brief.daysAhead).toBe(7);
    expect(brief.campaignTheme).toBe('Funk');
    expect(brief.totalCandidates).toBe(1);
    expect(brief.candidates).toHaveLength(1);

    const candidate = brief.candidates[0];
    expect(candidate).toMatchObject({
      concertId: approved.id,
      title: 'Dr. Bacon at The Pour House',
      artists: ['Dr. Bacon'],
      venueName: 'The Pour House Music Hall',
      city: 'Raleigh',
      state: 'NC',
      localDate: '2026-11-27',
      genre: 'Funk',
      sourceUrl: `/concerts/${approved.id}`,
      ticketUrl: 'https://tickets.example.com/dr-bacon',
      missingFacts: [],
      mediaRefs: [
        '/ingestion/uploads/upload-1/image',
        'https://cdn.example.com/dr-bacon.jpg',
      ],
      verifiedCollaborators: [
        {
          bandId: 'band-1',
          bandName: 'Dr. Bacon',
          instagramHandle: '@drbaconmusic',
        },
      ],
    });
    expect(candidate.confirmedTime).toContain('8:00 PM');
    expect(candidate.editorialTags).toEqual(
      expect.arrayContaining(['top-pick', 'featured', 'funk', 'theme-match']),
    );
  });

  it('clamps limit to 1..10', async () => {
    findApprovedConcertEntities.mockResolvedValue([]);

    const low = await service.generateBrief({ limit: 0 });
    expect(low.limit).toBe(1);
    expect(findApprovedConcertEntities).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 1 }),
    );

    const high = await service.generateBrief({ limit: 50 });
    expect(high.limit).toBe(10);
    expect(findApprovedConcertEntities).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('never fabricates missing times, ticket links, media, or IG handles and flags all missingFacts explicitly', async () => {
    const bareConcert = makeConcert({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Mystery Folk Night',
      genre: 'Folk',
      startsAt: new Date('2026-12-01T00:00:00.000Z'), // date-only midnight UTC
      ticketUrl: null,
      description: null,
      isTopPick: false,
      isFeatured: false,
      lineup: [
        {
          performanceOrder: 0,
          band: {
            id: 'band-2',
            name: 'Local Opener',
            instagramHandle: '   ',
            promoImageUrl: undefined,
          },
        } as any,
      ],
    });

    findApprovedConcertEntities.mockResolvedValue([bareConcert]);
    findUploads.mockResolvedValue([]);

    const brief = await service.generateBrief();
    const candidate = brief.candidates[0];

    expect(candidate.confirmedTime).toBeNull();
    expect(candidate.ticketUrl).toBeNull();
    expect(candidate.mediaRefs).toEqual([]);
    expect(candidate.verifiedCollaborators).toEqual([]);
    expect(candidate.missingFacts).toEqual([
      'missing_ticket_url',
      'unconfirmed_time',
      'missing_poster_media',
      'missing_verified_artist_ig_handle',
    ]);
  });

  it('treats local midnight (00:00 America/New_York) as unconfirmed time', async () => {
    const localMidnightConcert = makeConcert({
      id: '55555555-5555-4555-8555-555555555555',
      startsAt: new Date('2026-11-28T05:00:00.000Z'), // 00:00 EST
    });

    findApprovedConcertEntities.mockResolvedValue([localMidnightConcert]);

    const brief = await service.generateBrief();
    expect(brief.candidates[0].confirmedTime).toBeNull();
    expect(brief.candidates[0].missingFacts).toContain('unconfirmed_time');
  });

  it('formats a clean copyable Markdown brief for Muse and editorial review', async () => {
    findApprovedConcertEntities.mockResolvedValue([makeConcert()]);

    const brief = await service.generateBrief({
      campaignTheme: 'Triangle Weekend Radar',
    });
    const markdown = service.formatAsMarkdown(brief);

    expect(markdown).toContain('# Weekly Content Brief');
    expect(markdown).toContain('**Campaign Theme:** Triangle Weekend Radar');
    expect(markdown).toContain('## 1. Dr. Bacon at The Pour House');
    expect(markdown).toContain(
      '- **Source URL:** /concerts/11111111-1111-4111-8111-111111111111',
    );
    expect(markdown).toContain(
      '- **Verified Collaborators:** Dr. Bacon (@drbaconmusic)',
    );
  });

  it('renders an explicit empty-state message in Markdown when no candidates match', async () => {
    findApprovedConcertEntities.mockResolvedValue([]);

    const brief = await service.generateBrief();
    const markdown = service.formatAsMarkdown(brief);

    expect(markdown).toContain('# Weekly Content Brief');
    expect(markdown).toContain(
      '_No active, admin-approved upcoming concerts found in this window._',
    );
  });
});

describe('NewsletterController GET /newsletter/weekly-brief', () => {
  let app: INestApplication;
  const mockBriefService = {
    generateBrief: jest.fn(),
    formatAsMarkdown: jest.fn(),
  };

  let mockAuthPasses = true;
  let mockAdminEmail = 'ezvibesinc@gmail.com';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuthPasses = true;
    mockAdminEmail = 'ezvibesinc@gmail.com';

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController],
      providers: [
        { provide: NewsletterService, useValue: {} },
        { provide: BeehiivService, useValue: {} },
        { provide: NewsletterDistributionAuditorService, useValue: {} },
        { provide: NewsletterLineupHarvesterService, useValue: {} },
        { provide: NewsletterFeedbackLoopService, useValue: {} },
        { provide: WeeklyContentBriefService, useValue: mockBriefService },
        { provide: SocialConceptGeneratorService, useValue: {} },
        { provide: AuthService, useValue: { verifyIdToken: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('ezvibesinc@gmail.com') },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!mockAuthPasses) {
            throw new ForbiddenException('Missing auth');
          }
          const req = context.switchToHttp().getRequest();
          req.user = { email: mockAdminEmail };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('protects getWeeklyBrief with FirebaseAuthGuard and AdminEmailGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      NewsletterController.prototype.getWeeklyBrief,
    );
    expect(guards).toEqual([FirebaseAuthGuard, AdminEmailGuard]);
  });

  it('rejects non-admin users with 403', async () => {
    mockAdminEmail = 'reader@example.com';

    await request(app.getHttpServer())
      .get('/newsletter/weekly-brief')
      .expect(403);

    expect(mockBriefService.generateBrief).not.toHaveBeenCalled();
  });

  it('returns JSON brief by default and passes query params', async () => {
    const mockBrief = {
      generatedAt: '2026-11-25T19:00:00.000Z',
      windowStart: '2026-11-25T19:00:00.000Z',
      windowEnd: '2026-12-05T19:00:00.000Z',
      daysAhead: 10,
      limit: 5,
      campaignTheme: 'Holiday Shows',
      totalCandidates: 0,
      candidates: [],
    };
    mockBriefService.generateBrief.mockResolvedValue(mockBrief);

    const res = await request(app.getHttpServer())
      .get(
        '/newsletter/weekly-brief?daysAhead=10&limit=5&campaignTheme=Holiday%20Shows',
      )
      .expect(200);

    expect(mockBriefService.generateBrief).toHaveBeenCalledWith({
      daysAhead: 10,
      limit: 5,
      campaignTheme: 'Holiday Shows',
    });
    expect(res.body).toEqual(mockBrief);
  });

  it('returns Markdown when format=markdown', async () => {
    const mockBrief = {
      generatedAt: '2026-11-25T19:00:00.000Z',
      windowStart: '2026-11-25T19:00:00.000Z',
      windowEnd: '2026-12-02T19:00:00.000Z',
      daysAhead: 7,
      limit: 8,
      campaignTheme: null,
      totalCandidates: 0,
      candidates: [],
    };
    mockBriefService.generateBrief.mockResolvedValue(mockBrief);
    mockBriefService.formatAsMarkdown.mockReturnValue(
      '# Weekly Content Brief\n\n_No active, admin-approved upcoming concerts found in this window._',
    );

    const res = await request(app.getHttpServer())
      .get('/newsletter/weekly-brief?format=markdown')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.text).toContain('# Weekly Content Brief');
  });

  it('returns 400 for invalid format or non-integer limit', async () => {
    await request(app.getHttpServer())
      .get('/newsletter/weekly-brief?format=xml')
      .expect(400);

    await request(app.getHttpServer())
      .get('/newsletter/weekly-brief?limit=abc')
      .expect(400);
  });
});
