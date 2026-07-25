import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { OptionalFirebaseAuthGuard } from '../../auth/firebase-auth/optional-firebase-auth.guard';
import { UserService } from '../users/user.service';
import { ConcertController } from './concert.controller';
import { ConcertService } from './concert.service';

describe('ConcertController HTTP contract', () => {
  let app: INestApplication;
  const concertService = {
    findAll: jest.fn(),
    findAvailableGenres: jest.fn(),
  };
  const userService = {
    findExistingFromToken: jest.fn(),
    syncFromToken: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ConcertController],
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
      'Electronic',
      'Indie Rock',
      'Rock',
    ]);

    await request(app.getHttpServer())
      .get('/concerts/meta/genres')
      .expect(200)
      .expect({ genres: ['Electronic', 'Indie Rock', 'Rock'] });

    expect(userService.findExistingFromToken).not.toHaveBeenCalled();
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findAvailableGenres).toHaveBeenCalledTimes(1);
  });
});
