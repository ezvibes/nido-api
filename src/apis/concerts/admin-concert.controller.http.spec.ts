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

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminConcertController],
      providers: [
        { provide: ConcertService, useValue: concertService },
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
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
});
