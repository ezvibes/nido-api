import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { OptionalFirebaseAuthGuard } from '../../auth/firebase-auth/optional-firebase-auth.guard';
import { UserService } from '../users/user.service';
import { ConcertController, SitemapController } from './concert.controller';
import { ConcertService } from './concert.service';

describe('ConcertController HTTP contract', () => {
  let app: INestApplication;
  let controller: ConcertController;
  let sitemapController: SitemapController;
  const concertService = {
    findAll: jest.fn(),
    findOneForViewer: jest.fn(),
    findAvailableGenres: jest.fn(),
    generatePublicSitemapXml: jest.fn(),
    generatePublicSitemapIndexXml: jest.fn(),
  };
  const userService = {
    findExistingFromToken: jest.fn(),
    syncFromToken: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ConcertController, SitemapController],
      providers: [
        { provide: ConcertService, useValue: concertService },
        { provide: UserService, useValue: userService },
        {
          provide: AuthService,
          useValue: { verifyIdToken: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        FirebaseAuthGuard,
        OptionalFirebaseAuthGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    controller = module.get(ConcertController);
    sitemapController = module.get(SitemapController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    controller.resetPublicRateLimits();
    sitemapController.resetPublicRateLimits();
    concertService.findAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves GET /concerts without a bearer token or user write', async () => {
    await request(app.getHttpServer())
      .get('/concerts')
      .query({ sort: 'soonest', pageSize: 1 })
      .expect(200)
      .expect({
        data: [],
        total: 0,
        page: 1,
        pageSize: 1,
      });

    expect(userService.findExistingFromToken).not.toHaveBeenCalled();
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'soonest', pageSize: 1 }),
      undefined,
    );
  });

  it('serves GET /concerts/meta/genres without a bearer token or user lookup', async () => {
    concertService.findAvailableGenres.mockResolvedValue([
      { slug: 'electronic', name: 'Electronic' },
      { slug: 'rock', name: 'Rock' },
    ]);

    await request(app.getHttpServer())
      .get('/concerts/meta/genres')
      .expect(200)
      .expect({
        genres: ['Electronic', 'Rock'],
        options: [
          { slug: 'electronic', name: 'Electronic' },
          { slug: 'rock', name: 'Rock' },
        ],
      });

    expect(userService.findExistingFromToken).not.toHaveBeenCalled();
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findAvailableGenres).toHaveBeenCalledTimes(1);
  });

  it('validates venueId and bandId schedule filters on GET /concerts', async () => {
    const venueId = '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e';
    const bandId = 'a91f4d62-4e82-47d2-b78c-1f542d4f0a21';

    await request(app.getHttpServer())
      .get('/concerts')
      .query({ venueId, bandId })
      .expect(200);

    expect(concertService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ venueId, bandId }),
      undefined,
    );

    await request(app.getHttpServer())
      .get('/concerts')
      .query({ venueId: 'not-a-uuid' })
      .expect(400);
  });

  it('enforces rate limiting on repeated public GET /concerts and /sitemap.xml requests', async () => {
    for (let i = 0; i < 120; i += 1) {
      await request(app.getHttpServer())
        .get('/concerts')
        .set('x-forwarded-for', '198.51.100.50')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/concerts')
      .set('x-forwarded-for', '198.51.100.50')
      .expect(429);

    concertService.generatePublicSitemapXml.mockResolvedValue('<urlset />');
    for (let i = 0; i < 120; i += 1) {
      await request(app.getHttpServer())
        .get('/sitemap.xml')
        .set('x-forwarded-for', '198.51.100.51')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/sitemap.xml')
      .set('x-forwarded-for', '198.51.100.51')
      .expect(429);

    concertService.generatePublicSitemapIndexXml.mockResolvedValue(
      '<sitemapindex />',
    );
    await request(app.getHttpServer())
      .get('/sitemap-index.xml')
      .set('x-forwarded-for', '198.51.100.51')
      .expect(429);
  });

  it('validates UUID on GET /concerts/:id and enforces public rate limiting', async () => {
    const validConcertId = '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e';
    concertService.findOneForViewer.mockResolvedValue({
      id: validConcertId,
      title: 'Public Show',
    });

    await request(app.getHttpServer()).get('/concerts/not-a-uuid').expect(400);

    await request(app.getHttpServer())
      .get(`/concerts/${validConcertId}`)
      .expect(200);

    for (let i = 0; i < 120; i += 1) {
      await request(app.getHttpServer())
        .get('/concerts/meta/genres')
        .set('x-forwarded-for', '198.51.100.52')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get(`/concerts/${validConcertId}`)
      .set('x-forwarded-for', '198.51.100.52')
      .expect(429);
  });
});
