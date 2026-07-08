import { Test, TestingModule } from '@nestjs/testing';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';

describe('VenueController', () => {
  let controller: VenueController;
  let service: VenueService;

  const mockVenueService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCity: jest.fn(),
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
    }).compile();

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

  describe('findOne', () => {
    it('should call findOne on service with correct ID', async () => {
      const venue = { id: '1', name: 'Venue' } as Venue;
      mockVenueService.findOne.mockResolvedValue(venue);

      const result = await controller.findOne('1');

      expect(mockVenueService.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(venue);
    });
  });
});
