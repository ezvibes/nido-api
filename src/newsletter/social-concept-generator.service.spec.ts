import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';
import { WeeklyContentBrief } from '../contracts/content-brief.contract';
import { SocialConceptSchema } from '../contracts/social-concept.contract';
import { BeehiivService } from './beehiiv.service';
import { NewsletterDistributionAuditorService } from './newsletter-distribution-auditor.service';
import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { SocialConceptGeneratorService } from './social-concept-generator.service';
import { WeeklyContentBriefService } from './weekly-content-brief.service';

function makeSampleBrief(
  overrides: Partial<WeeklyContentBrief> = {},
): WeeklyContentBrief {
  return {
    generatedAt: '2026-11-25T19:00:00.000Z',
    windowStart: '2026-11-25T19:00:00.000Z',
    windowEnd: '2026-12-02T19:00:00.000Z',
    daysAhead: 7,
    limit: 8,
    campaignTheme: 'Winter Indie NC',
    totalCandidates: 2,
    candidates: [
      {
        concertId: 'concert-1',
        title: 'Indigo Echoes + River Pines',
        artists: ['Indigo Echoes', 'River Pines'],
        venueName: "Cat's Cradle",
        city: 'Carrboro',
        state: 'NC',
        localDate: '2026-11-28',
        confirmedTime: '8:00 PM EST',
        genre: 'Indie Rock',
        editorialTags: ['top-pick', 'co-bill', 'indie rock'],
        sourceUrl: '/concerts/concert-1',
        ticketUrl: 'https://tickets.example.com/concert-1',
        editorialAngle:
          "Weekly Top Pick • Indie Rock bill: Indigo Echoes + River Pines at Cat's Cradle in Carrboro, NC.",
        missingFacts: [],
        mediaRefs: ['/ingestion/uploads/upload-1/image'],
        verifiedCollaborators: [
          {
            bandId: 'band-1',
            bandName: 'Indigo Echoes',
            instagramHandle: '@indigoechoesnc',
          },
        ],
      },
      {
        concertId: 'concert-2',
        title: 'Pinecone Brass',
        artists: ['Pinecone Brass'],
        venueName: 'The Pour House',
        city: 'Raleigh',
        state: 'NC',
        localDate: '2026-11-29',
        confirmedTime: null,
        genre: 'Brass Funk',
        editorialTags: ['featured', 'brass funk'],
        sourceUrl: '/concerts/concert-2',
        ticketUrl: null,
        editorialAngle:
          'Featured show • Brass Funk bill: Pinecone Brass at The Pour House in Raleigh, NC.',
        missingFacts: [
          'missing_ticket_url',
          'unconfirmed_time',
          'missing_poster_media',
          'missing_verified_artist_ig_handle',
        ],
        mediaRefs: [],
        verifiedCollaborators: [],
      },
    ],
    ...overrides,
  };
}

describe('SocialConceptGeneratorService', () => {
  const mockGenerateBrief = jest.fn();
  const mockBriefService = {
    generateBrief: mockGenerateBrief,
  } as unknown as WeeklyContentBriefService;

  let service: SocialConceptGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SocialConceptGeneratorService(mockBriefService);
  });

  it('generates 3 distinct concepts aligned to the 3 recurring pillars and supports carousel + reel formats', () => {
    const brief = makeSampleBrief();
    const batch = service.generateFromBrief(brief);

    expect(batch.totalConcepts).toBe(3);
    expect(batch.concepts).toHaveLength(3);

    const pillars = batch.concepts.map((c) => c.pillar);
    expect(new Set(pillars)).toEqual(
      new Set([
        'upcoming_show_guide',
        'artist_festival_spotlight',
        'community_culture_moment',
      ]),
    );

    const formats = batch.concepts.map((c) => c.format);
    expect(formats).toContain('carousel');
    expect(formats).toContain('reel');

    for (const concept of batch.concepts) {
      expect(concept.requiresHumanReview).toBe(true);
      expect(concept.approvalStatus).toBe('pending_review');
      expect(concept.primaryHook.length).toBeGreaterThan(0);
      expect(concept.timelinessRationale.length).toBeGreaterThan(0);
      expect(concept.editableCaptionDraft.length).toBeGreaterThan(0);
      expect(concept.slideOrReelStructure.length).toBeGreaterThanOrEqual(3);
      expect(concept.primaryCta.length).toBeGreaterThan(0);
      expect(concept.accompanyingStory.length).toBeGreaterThan(0);
      expect(concept.newsletterConnection.length).toBeGreaterThan(0);
    }
  });

  it('enforces requiresHumanReview: true in SocialConceptSchema', () => {
    const valid = makeSampleBrief();
    const batch = service.generateFromBrief(valid);
    const first = batch.concepts[0];

    expect(() =>
      SocialConceptSchema.parse({
        ...first,
        requiresHumanReview: false,
      }),
    ).toThrow();
  });

  it('preserves strict source-fact fidelity, verified-only collaborator handles, and flags missing details', () => {
    const brief = makeSampleBrief({
      candidates: [makeSampleBrief().candidates[1]], // concert-2 with missing time, ticketUrl, media, handle
      totalCandidates: 1,
    });

    const batch = service.generateFromBrief(brief);

    for (const concept of batch.concepts) {
      expect(concept.sourceFacts).toEqual([
        {
          concertId: 'concert-2',
          title: 'Pinecone Brass',
          artists: ['Pinecone Brass'],
          venueName: 'The Pour House',
          city: 'Raleigh',
          state: 'NC',
          localDate: '2026-11-29',
          confirmedTime: null,
          ticketUrl: null,
          sourceUrl: '/concerts/concert-2',
        },
      ]);
      expect(concept.verifiedCollaboratorTags).toEqual([]);
      expect(concept.mediaRefs).toEqual([]);
      expect(concept.missingDetails).toEqual(
        expect.arrayContaining([
          'missing_ticket_url',
          'unconfirmed_time',
          'missing_poster_media',
          'missing_verified_artist_ig_handle',
        ]),
      );
      expect(concept.editableCaptionDraft).not.toMatch(/@pinecone/i);
      expect(concept.editableCaptionDraft).not.toMatch(
        /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i,
      );
    }
  });

  it('handles empty candidate briefs without inventing facts', () => {
    const brief = makeSampleBrief({
      totalCandidates: 0,
      candidates: [],
    });

    const batch = service.generateFromBrief(brief);
    expect(batch.concepts).toHaveLength(3);
    for (const concept of batch.concepts) {
      expect(concept.sourceFacts).toEqual([]);
      expect(concept.verifiedCollaboratorTags).toEqual([]);
      expect(concept.mediaRefs).toEqual([]);
      expect(concept.missingDetails).toEqual(
        expect.arrayContaining([
          'no_approved_concerts_in_window',
          'missing_poster_media',
        ]),
      );
      expect(concept.requiresHumanReview).toBe(true);
      expect(concept.approvalStatus).toBe('pending_review');
    }
  });

  it('generateWeeklyConcepts delegates to WeeklyContentBriefService.generateBrief and generates batch', async () => {
    const brief = makeSampleBrief();
    mockGenerateBrief.mockResolvedValue(brief);

    const batch = await service.generateWeeklyConcepts({
      daysAhead: 10,
      limit: 5,
      campaignTheme: 'Winter Indie NC',
    });

    expect(mockGenerateBrief).toHaveBeenCalledWith({
      daysAhead: 10,
      limit: 5,
      campaignTheme: 'Winter Indie NC',
    });
    expect(batch.totalConcepts).toBe(3);
    expect(batch.campaignTheme).toBe('Winter Indie NC');
    expect(batch.concepts[0].verifiedCollaboratorTags).toEqual([
      {
        bandId: 'band-1',
        bandName: 'Indigo Echoes',
        instagramHandle: '@indigoechoesnc',
      },
    ]);
  });

  it('formats Muse handoff Markdown cleanly', () => {
    const brief = makeSampleBrief();
    const batch = service.generateFromBrief(brief);
    const md = service.formatAsMarkdown(batch);

    expect(md).toContain('# Weekly Social Concepts (Muse Handoff)');
    expect(md).toContain('**Pillar:** upcoming_show_guide');
    expect(md).toContain('**Pillar:** artist_festival_spotlight');
    expect(md).toContain('**Pillar:** community_culture_moment');
    expect(md).toContain('**Format:** carousel');
    expect(md).toContain('**Format:** reel');
    expect(md).toContain('**Requires Human Review:** true');
    expect(md).toContain('**Approval Status:** pending_review');
    expect(md).toContain('@indigoechoesnc');
    expect(md).toContain('### Slide / Reel Structure');
    expect(md).toContain('### Editable Caption Draft');
    expect(md).toContain('### Source Facts');
  });
});

describe('NewsletterController social concepts endpoints', () => {
  let app: INestApplication;
  const mockBriefService = {
    generateBrief: jest.fn(),
    formatAsMarkdown: jest.fn(),
  };
  const mockSocialConceptService = {
    generateWeeklyConcepts: jest.fn(),
    generateFromBrief: jest.fn(),
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
        {
          provide: SocialConceptGeneratorService,
          useValue: mockSocialConceptService,
        },
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

  it('protects social concept endpoints with FirebaseAuthGuard and AdminEmailGuard', () => {
    const getGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      NewsletterController.prototype.getSocialConcepts,
    );
    const postGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      NewsletterController.prototype.generateSocialConceptsFromBrief,
    );
    expect(getGuards).toEqual([FirebaseAuthGuard, AdminEmailGuard]);
    expect(postGuards).toEqual([FirebaseAuthGuard, AdminEmailGuard]);
  });

  it('rejects non-admin users with 403 on GET and POST', async () => {
    mockAdminEmail = 'reader@example.com';

    await request(app.getHttpServer())
      .get('/newsletter/social-concepts')
      .expect(403);

    await request(app.getHttpServer())
      .post('/newsletter/social-concepts/from-brief')
      .send(makeSampleBrief())
      .expect(403);

    expect(
      mockSocialConceptService.generateWeeklyConcepts,
    ).not.toHaveBeenCalled();
    expect(mockSocialConceptService.generateFromBrief).not.toHaveBeenCalled();
  });

  it('GET /newsletter/social-concepts returns JSON batch and passes query params', async () => {
    const realService = new SocialConceptGeneratorService(
      mockBriefService as unknown as WeeklyContentBriefService,
    );
    const batch = realService.generateFromBrief(makeSampleBrief());
    mockSocialConceptService.generateWeeklyConcepts.mockResolvedValue(batch);

    const res = await request(app.getHttpServer())
      .get(
        '/newsletter/social-concepts?daysAhead=10&limit=5&campaignTheme=Winter%20Indie%20NC',
      )
      .expect(200);

    expect(
      mockSocialConceptService.generateWeeklyConcepts,
    ).toHaveBeenCalledWith({
      daysAhead: 10,
      limit: 5,
      campaignTheme: 'Winter Indie NC',
    });
    expect(res.body.totalConcepts).toBe(3);
  });

  it('GET /newsletter/social-concepts?format=markdown returns text/markdown', async () => {
    const realService = new SocialConceptGeneratorService(
      mockBriefService as unknown as WeeklyContentBriefService,
    );
    const batch = realService.generateFromBrief(makeSampleBrief());
    mockSocialConceptService.generateWeeklyConcepts.mockResolvedValue(batch);
    mockSocialConceptService.formatAsMarkdown.mockReturnValue(
      '# Weekly Social Concepts (Muse Handoff)',
    );

    const res = await request(app.getHttpServer())
      .get('/newsletter/social-concepts?format=markdown')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.text).toContain('# Weekly Social Concepts (Muse Handoff)');
  });

  it('GET /newsletter/social-concepts rejects invalid format with 400', async () => {
    await request(app.getHttpServer())
      .get('/newsletter/social-concepts?format=xml')
      .expect(400);
  });

  it('POST /newsletter/social-concepts/from-brief validates brief and returns batch', async () => {
    const brief = makeSampleBrief();
    const realService = new SocialConceptGeneratorService(
      mockBriefService as unknown as WeeklyContentBriefService,
    );
    const batch = realService.generateFromBrief(brief);
    mockSocialConceptService.generateFromBrief.mockReturnValue(batch);

    const res = await request(app.getHttpServer())
      .post('/newsletter/social-concepts/from-brief')
      .send(brief)
      .expect(200);

    expect(mockSocialConceptService.generateFromBrief).toHaveBeenCalledWith(
      brief,
    );
    expect(res.body.totalConcepts).toBe(3);
  });

  it('POST /newsletter/social-concepts/from-brief rejects invalid brief payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/newsletter/social-concepts/from-brief')
      .send({ invalid: true })
      .expect(400);

    expect(mockSocialConceptService.generateFromBrief).not.toHaveBeenCalled();
  });
});
