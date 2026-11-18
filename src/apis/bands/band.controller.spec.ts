import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BandController } from './band.controller';
import { BandService } from './band.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

describe('BandController', () => {
  let controller: BandController;

  const mockBandService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BandController],
      providers: [
        {
          provide: BandService,
          useValue: mockBandService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminEmailGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BandController>(BandController);
  });

  afterEach(() => {
    controller.resetPublicRateLimits();
    jest.clearAllMocks();
  });

  it('lists bands and gets bands by ID or slug publicly', async () => {
    const bands = [{ id: 'b1', name: 'Sylvan Esso', slug: 'sylvan-esso' }];
    mockBandService.findAll.mockResolvedValue(bands);
    mockBandService.findOne.mockResolvedValue(bands[0]);
    mockBandService.findBySlug.mockResolvedValue(bands[0]);

    expect(await controller.findAll({ q: 'Sylvan' })).toEqual(bands);
    expect(await controller.findOne('b1')).toEqual(bands[0]);
    expect(await controller.findBySlug('sylvan-esso')).toEqual(bands[0]);
  });

  it('rate-limits excessive public band discovery reads', async () => {
    mockBandService.findAll.mockResolvedValue([]);
    const req = { headers: { 'x-forwarded-for': '203.0.113.8' } } as never;

    for (let i = 0; i < 120; i += 1) {
      await controller.findAll({}, req);
    }

    await expect(controller.findAll({}, req)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});
