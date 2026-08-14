import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { UserService } from '../users/user.service';
import { AdminConcertController } from './admin-concert.controller';
import { ConcertService } from './concert.service';
import { IngestionService } from '../../ingestion/ingestion.service';

describe('AdminConcertController HTTP contract', () => {
  let app: INestApplication;
  const concertService = {
    findAllAdmin: jest.fn(),
    findOneAdmin: jest.fn(),
    updateAdmin: jest.fn(),
    setAdminApproval: jest.fn(),
  };
  const userService = { syncFromToken: jest.fn() };
  const authService = { verifyIdToken: jest.fn() };
  const ingestionService = { attachPosterToConcert: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminConcertController],
      providers: [
        { provide: ConcertService, useValue: concertService },
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
        { provide: IngestionService, useValue: ingestionService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ADMIN_EMAILS' ? 'admin@example.com' : undefined,
            ),
          },
        },
        FirebaseAuthGuard,
        AdminEmailGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.verifyIdToken.mockImplementation(async (token: string) => ({
      uid: `${token}-uid`,
      email: token === 'admin-token' ? 'admin@example.com' : 'user@example.com',
    }));
    concertService.findAllAdmin.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin catalog requests', async () => {
    await request(app.getHttpServer()).get('/admin/concerts').expect(401);
    await request(app.getHttpServer())
      .get('/admin/concerts')
      .set('Authorization', 'Bearer user-token')
      .expect(403);

    expect(concertService.findAllAdmin).not.toHaveBeenCalled();
  });

  it('defaults an authenticated admin list to every catalog state', async () => {
    await request(app.getHttpServer())
      .get('/admin/concerts')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(concertService.findAllAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ catalogStatus: 'all', page: 1, pageSize: 20 }),
    );
  });

  it('validates optimistic concurrency before an admin update', async () => {
    await request(app.getHttpServer())
      .patch('/admin/concerts/concert-1')
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Updated title' })
      .expect(400);

    expect(concertService.updateAdmin).not.toHaveBeenCalled();
  });

  it('passes a validated admin update to the service', async () => {
    concertService.updateAdmin.mockResolvedValue({
      id: 'concert-1',
      title: 'Updated title',
      version: 4,
    });

    await request(app.getHttpServer())
      .patch('/admin/concerts/concert-1')
      .set('Authorization', 'Bearer admin-token')
      .send({ expectedVersion: 3, title: 'Updated title' })
      .expect(200)
      .expect({
        id: 'concert-1',
        title: 'Updated title',
        version: 4,
      });

    expect(concertService.updateAdmin).toHaveBeenCalledWith('concert-1', {
      expectedVersion: 3,
      title: 'Updated title',
    });
  });

  it('trims admin text fields before passing them to the service', async () => {
    concertService.updateAdmin.mockResolvedValue({
      id: 'concert-1',
      version: 4,
    });

    await request(app.getHttpServer())
      .patch('/admin/concerts/concert-1')
      .set('Authorization', 'Bearer admin-token')
      .send({
        expectedVersion: 3,
        title: '  Updated title  ',
        genre: '  Rock  ',
      })
      .expect(200);

    expect(concertService.updateAdmin).toHaveBeenCalledWith('concert-1', {
      expectedVersion: 3,
      title: 'Updated title',
      genre: 'Rock',
    });
  });

  it.each([
    ['whitespace-only title', { expectedVersion: 3, title: '   ' }],
    [
      'title longer than 255 characters',
      { expectedVersion: 3, title: 'x'.repeat(256) },
    ],
    [
      'genre longer than 120 characters',
      { expectedVersion: 3, genre: 'x'.repeat(121) },
    ],
    ['null title', { expectedVersion: 3, title: null }],
    ['null genre', { expectedVersion: 3, genre: null }],
    ['null start time', { expectedVersion: 3, startsAt: null }],
    ['null catalog status', { expectedVersion: 3, catalogStatus: null }],
    ['null Featured state', { expectedVersion: 3, isFeatured: null }],
    [
      'null sync-resume command',
      { expectedVersion: 3, resumeSyncUpdates: null },
    ],
  ])('rejects %s before calling the service', async (_caseName, payload) => {
    await request(app.getHttpServer())
      .patch('/admin/concerts/concert-1')
      .set('Authorization', 'Bearer admin-token')
      .send(payload)
      .expect(400);

    expect(concertService.updateAdmin).not.toHaveBeenCalled();
  });

  it('updates admin approval status on PUT /admin/concerts/:id/approval', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 1, email: 'admin@example.com' });
    concertService.setAdminApproval.mockResolvedValue({
      id: 'concert-1',
      isAdminApproved: true,
    });

    await request(app.getHttpServer())
      .put('/admin/concerts/concert-1/approval')
      .set('Authorization', 'Bearer admin-token')
      .send({ approved: true })
      .expect(200)
      .expect({
        id: 'concert-1',
        isAdminApproved: true,
      });

    expect(concertService.setAdminApproval).toHaveBeenCalledWith(
      'concert-1',
      { id: 1, email: 'admin@example.com' },
      true,
    );
  });

  it('attaches a poster image on POST /admin/concerts/:id/poster', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 1, email: 'admin@example.com' });
    ingestionService.attachPosterToConcert.mockResolvedValue({
      uploadId: 'upload-uuid',
      posterUrl: '/ingestion/uploads/upload-uuid/image',
    });

    await request(app.getHttpServer())
      .post('/admin/concerts/concert-1/poster')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', Buffer.from('fake-image-bytes'), 'poster.jpg')
      .expect(201)
      .expect({
        uploadId: 'upload-uuid',
        posterUrl: '/ingestion/uploads/upload-uuid/image',
      });

    expect(ingestionService.attachPosterToConcert).toHaveBeenCalledWith(
      'concert-1',
      expect.objectContaining({ originalname: 'poster.jpg' }),
      'admin-token-uid',
      1,
    );
  });
});

