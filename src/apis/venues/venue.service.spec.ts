import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VenueService } from './venue.service';
import { Venue, VenueVerificationState } from './entities/venue.entity';

describe('VenueService', () => {
  let service: VenueService;
  let repository: Repository<Venue>;

  const mockVenueRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
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
    it('should successfully create and save a venue with postal code and capacity', async () => {
      const dto = {
        name: 'Test Venue',
        city: 'Wilmington',
        citySlug: 'wilmington',
        postalCode: '28401',
        capacity: 250,
        verificationState: VenueVerificationState.VERIFIED,
      };
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
    it('should return list of all venues ordered by name when no query provided', async () => {
      const venues = [
        { id: '1', name: 'A Venue' },
        { id: '2', name: 'B Venue' },
      ];
      mockVenueRepository.find.mockResolvedValue(venues);

      const result = await service.findAll();

      expect(mockVenueRepository.find).toHaveBeenCalledWith({
        where: undefined,
        order: { name: 'ASC' },
      });
      expect(result).toEqual(venues);
    });

    it('should filter venues by verification state', async () => {
      const unverifiedVenues = [
        {
          id: '1',
          name: 'Underground Room',
          verificationState: VenueVerificationState.UNVERIFIED,
        },
      ];
      mockVenueRepository.find.mockResolvedValue(unverifiedVenues);

      const result = await service.findAll({
        verificationState: VenueVerificationState.UNVERIFIED,
      });

      expect(mockVenueRepository.find).toHaveBeenCalledWith({
        where: { verificationState: VenueVerificationState.UNVERIFIED },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(unverifiedVenues);
    });
  });

  describe('findOne', () => {
    it('should return a venue if found', async () => {
      const venue = { id: '1', name: 'Test Venue' } as Venue;
      mockVenueRepository.findOne.mockResolvedValue(venue);

      const result = await service.findOne('1');

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
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

  describe('update', () => {
    it('should successfully update and save a venue with new verification state and postal code', async () => {
      const existingVenue = {
        id: '1',
        name: 'Old Name',
        citySlug: 'wilmington',
        verificationState: VenueVerificationState.UNVERIFIED,
      } as Venue;
      const updateDto = {
        postalCode: '28401',
        capacity: 300,
        verificationState: VenueVerificationState.VERIFIED,
      };
      const updatedVenue = { ...existingVenue, ...updateDto } as Venue;

      mockVenueRepository.findOne.mockResolvedValue(existingVenue);
      mockVenueRepository.save.mockResolvedValue(updatedVenue);

      const result = await service.update('1', updateDto);

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockVenueRepository.save).toHaveBeenCalledWith(updatedVenue);
      expect(result).toEqual(updatedVenue);
    });
  });

  describe('delete', () => {
    it('should successfully remove a venue', async () => {
      const venue = { id: '1', name: 'Venue' } as Venue;
      mockVenueRepository.findOne.mockResolvedValue(venue);
      mockVenueRepository.remove.mockResolvedValue(venue);

      await service.delete('1');

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockVenueRepository.remove).toHaveBeenCalledWith(venue);
    });
  });

  describe('findOrCreateByName', () => {
    it('should set verificationState to UNVERIFIED for newly created venues', async () => {
      mockVenueRepository.findOne.mockResolvedValue(null);
      const createdVenue = {
        id: 'new-id',
        name: 'Fresh Spot',
        city: 'Durham',
        citySlug: 'durham',
        region: 'North Carolina',
        regionSlug: 'north-carolina',
        verificationState: VenueVerificationState.UNVERIFIED,
      } as Venue;

      mockVenueRepository.create.mockReturnValue(createdVenue);
      mockVenueRepository.save.mockResolvedValue(createdVenue);

      const result = await service.findOrCreateByName(
        'Fresh Spot',
        'Durham',
        'North Carolina',
      );

      expect(mockVenueRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fresh Spot',
          city: 'Durham',
          verificationState: VenueVerificationState.UNVERIFIED,
        }),
      );
      expect(result).toEqual(createdVenue);
    });
  });
});
