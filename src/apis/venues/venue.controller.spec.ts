import { Test, TestingModule } from '@nestjs/testing';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

describe('VenueController', () => {
  let controller: VenueController;
  let service: VenueService;

  const mockVenueService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCity: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [
        {
          provide: VenueService,
          useValue: mockVenueService,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminEmailGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VenueController>(VenueController);
    service = module.get<VenueService>(VenueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call findAll on service when no citySlug is provided', async () => {
      const venues = [{ id: '1', name: 'Venue' }] as Venue[];
      mockVenueService.findAll.mockResolvedValue(venues);

      const result = await controller.findAll({});

      expect(mockVenueService.findAll).toHaveBeenCalled();
      expect(result).toEqual(venues);
    });

    it('should call findByCity on service when citySlug is provided', async () => {
      const venues = [{ id: '1', name: 'Venue', citySlug: 'wilmington' }] as Venue[];
      mockVenueService.findByCity.mockResolvedValue(venues);

      const result = await controller.findAll({ citySlug: 'wilmington' });

      expect(mockVenueService.findByCity).toHaveBeenCalledWith('wilmington');
      expect(result).toEqual(venues);
    });
  });

  describe('create', () => {
    it('should call create on service with correct DTO', async () => {
      const dto = { name: 'Venue', city: 'Charlotte', citySlug: 'charlotte', region: 'NC', regionSlug: 'nc' };
      const venue = { id: '1', ...dto } as Venue;
      mockVenueService.create.mockResolvedValue(venue);

      const result = await controller.create(dto);

      expect(mockVenueService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(venue);
    });
  });

  describe('update', () => {
    it('should call update on service with correct ID and DTO', async () => {
      const dto = { name: 'New Name' };
      const venue = { id: '1', name: 'New Name' } as Venue;
      mockVenueService.update.mockResolvedValue(venue);

      const result = await controller.update('1', dto);

      expect(mockVenueService.update).toHaveBeenCalledWith('1', dto);
      expect(result).toEqual(venue);
    });
  });

  describe('delete', () => {
    it('should call delete on service with correct ID', async () => {
      mockVenueService.delete.mockResolvedValue(undefined);

      await controller.delete('1');

      expect(mockVenueService.delete).toHaveBeenCalledWith('1');
    });
  });
});
