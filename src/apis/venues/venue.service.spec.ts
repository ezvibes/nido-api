import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';

describe('VenueService', () => {
  let service: VenueService;
  let repository: Repository<Venue>;

  const mockVenueRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenueService,
        {
          provide: getRepositoryToken(Venue),
          useValue: mockVenueRepository,
        },
      ],
    }).compile();

    service = module.get<VenueService>(VenueService);
    repository = module.get<Repository<Venue>>(getRepositoryToken(Venue));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create and save a venue', async () => {
      const dto = { name: 'Test Venue', city: 'Wilmington', citySlug: 'wilmington' };
      const venue = { id: 'uuid', ...dto } as Venue;

      mockVenueRepository.create.mockReturnValue(venue);
      mockVenueRepository.save.mockResolvedValue(venue);

      const result = await service.create(dto);

      expect(mockVenueRepository.create).toHaveBeenCalledWith(dto);
      expect(mockVenueRepository.save).toHaveBeenCalledWith(venue);
      expect(result).toEqual(venue);
    });
  });

  describe('findAll', () => {
    it('should return list of all venues ordered by name', async () => {
      const venues = [{ id: '1', name: 'A Venue' }, { id: '2', name: 'B Venue' }];
      mockVenueRepository.find.mockResolvedValue(venues);

      const result = await service.findAll();

      expect(mockVenueRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
      expect(result).toEqual(venues);
    });
  });

  describe('findOne', () => {
    it('should return a venue if found', async () => {
      const venue = { id: '1', name: 'Test Venue' } as Venue;
      mockVenueRepository.findOne.mockResolvedValue(venue);

      const result = await service.findOne('1');

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(venue);
    });

    it('should throw NotFoundException if venue not found', async () => {
      mockVenueRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCity', () => {
    it('should return venues filtered by city slug', async () => {
      const venues = [{ id: '1', name: 'Test Venue', citySlug: 'wilmington' }];
      mockVenueRepository.find.mockResolvedValue(venues);

      const result = await service.findByCity('wilmington');

      expect(mockVenueRepository.find).toHaveBeenCalledWith({
        where: { citySlug: 'wilmington' },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(venues);
    });
  });
});
