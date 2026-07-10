import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventService } from './event.service';
import { Event } from './entities/event.entity';
import { Venue } from '../venues/entities/venue.entity';

describe('EventService', () => {
  let service: EventService;
  let eventRepository: Repository<Event>;
  let venueRepository: Repository<Venue>;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockEventRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn((target, source) => Object.assign(target, source)),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockVenueRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Venue),
          useValue: mockVenueRepository,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    venueRepository = module.get<Repository<Venue>>(getRepositoryToken(Venue));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create an event when venue exists', async () => {
      const venue = { id: 'venue-uuid', name: 'Cat\'s Cradle' } as Venue;
      const dto = { title: 'The Floozies Live', dateTime: '2026-07-24T19:00:00.000Z', venueId: 'venue-uuid' };
      const event = { id: 'event-uuid', ...dto, venue } as unknown as Event;

      mockVenueRepository.findOne.mockResolvedValue(venue);
      mockEventRepository.create.mockReturnValue(event);
      mockEventRepository.save.mockResolvedValue(event);

      const result = await service.create(dto);

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({ where: { id: 'venue-uuid' } });
      expect(mockEventRepository.create).toHaveBeenCalledWith({
        title: 'The Floozies Live',
        description: undefined,
        dateTime: new Date(dto.dateTime),
        ticketUrl: undefined,
        venueId: 'venue-uuid',
        venue,
      });
      expect(mockEventRepository.save).toHaveBeenCalledWith(event);
      expect(result).toEqual(event);
    });

    it('should throw BadRequestException if venue does not exist', async () => {
      const dto = { title: 'The Floozies Live', dateTime: '2026-07-24T19:00:00.000Z', venueId: 'non-existing' };
      mockVenueRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should query events with filters', async () => {
      const events = [{ id: '1', title: 'Show A' }];
      mockQueryBuilder.getMany.mockResolvedValue(events);

      const result = await service.findAll({
        q: 'Show',
        venueId: 'venue-1',
        startsAfter: '2026-07-01T00:00:00.000Z',
        startsBefore: '2026-07-31T23:59:59.000Z',
      });

      expect(mockEventRepository.createQueryBuilder).toHaveBeenCalledWith('event');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('event.venue', 'venue');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('(event.title ILIKE :q OR event.description ILIKE :q)', { q: '%Show%' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.venueId = :venueId', { venueId: 'venue-1' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.dateTime >= :startsAfter', { startsAfter: new Date('2026-07-01T00:00:00.000Z') });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.dateTime <= :startsBefore', { startsBefore: new Date('2026-07-31T23:59:59.000Z') });
      expect(result).toEqual(events);
    });
  });

  describe('findOne', () => {
    it('should return event by id', async () => {
      const event = { id: '1', title: 'Show A' } as Event;
      mockEventRepository.findOne.mockResolvedValue(event);

      const result = await service.findOne('1');

      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['venue'],
      });
      expect(result).toEqual(event);
    });

    it('should throw NotFoundException if event not found', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should successfully update event properties and check venue', async () => {
      const existing = { id: '1', title: 'Old Title', venueId: 'venue-1' } as Event;
      const venue = { id: 'venue-2', name: 'Cat\'s Cradle' } as Venue;
      const dto = { title: 'New Title', venueId: 'venue-2' };
      const updated = { id: '1', title: 'New Title', venueId: 'venue-2', venue } as unknown as Event;

      mockEventRepository.findOne.mockResolvedValue(existing);
      mockVenueRepository.findOne.mockResolvedValue(venue);
      mockEventRepository.save.mockResolvedValue(updated);

      const result = await service.update('1', dto);

      expect(mockVenueRepository.findOne).toHaveBeenCalledWith({ where: { id: 'venue-2' } });
      expect(mockEventRepository.save).toHaveBeenCalledWith(updated);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should successfully delete an event', async () => {
      const event = { id: '1', title: 'Show A' } as Event;
      mockEventRepository.findOne.mockResolvedValue(event);
      mockEventRepository.remove.mockResolvedValue(event);

      await service.remove('1');

      expect(mockEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['venue'],
      });
      expect(mockEventRepository.remove).toHaveBeenCalledWith(event);
    });
  });
});
