import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BandService } from './band.service';
import { Band } from './entities/band.entity';

describe('BandService', () => {
  let service: BandService;
  let repository: Repository<Band>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockBandRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn((target, source) => Object.assign(target, source)),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BandService,
        {
          provide: getRepositoryToken(Band),
          useValue: mockBandRepository,
        },
      ],
    }).compile();

    service = module.get<BandService>(BandService);
    repository = module.get<Repository<Band>>(getRepositoryToken(Band));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create and save a band with auto-generated slug', async () => {
      const dto = { name: 'The Floozies', genres: ['Electronic', 'Funk'] };
      const band = { id: 'uuid', ...dto, slug: 'the-floozies' } as unknown as Band;

      mockBandRepository.findOne.mockResolvedValue(null);
      mockBandRepository.create.mockReturnValue(band);
      mockBandRepository.save.mockResolvedValue(band);

      const result = await service.create(dto);

      expect(mockBandRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'the-floozies' } });
      expect(mockBandRepository.create).toHaveBeenCalledWith({
        ...dto,
        slug: 'the-floozies',
        genres: ['electronic', 'funk'],
      });
      expect(mockBandRepository.save).toHaveBeenCalledWith(band);
      expect(result).toEqual(band);
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto = { name: 'The Floozies' };
      mockBandRepository.findOne.mockResolvedValue({ id: 'existing-id' } as unknown as Band);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should query and return bands list', async () => {
      const bands = [{ id: '1', name: 'B Band' }, { id: '2', name: 'A Band' }];
      mockQueryBuilder.getMany.mockResolvedValue(bands);

      const result = await service.findAll({ q: 'Band', genre: 'Funk', isFeatured: true });

      expect(mockBandRepository.createQueryBuilder).toHaveBeenCalledWith('band');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('band.name ILIKE :q', { q: '%Band%' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(':genre = ANY(band.genres)', { genre: 'funk' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('band.isFeatured = :isFeatured', { isFeatured: true });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('band.name', 'ASC');
      expect(result).toEqual(bands);
    });
  });

  describe('findOne', () => {
    it('should return band by id', async () => {
      const band = { id: '1', name: 'B Band' } as unknown as Band;
      mockBandRepository.findOne.mockResolvedValue(band);

      const result = await service.findOne('1');

      expect(mockBandRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(band);
    });

    it('should throw NotFoundException if band not found by id', async () => {
      mockBandRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return band by slug', async () => {
      const band = { id: '1', name: 'B Band', slug: 'b-band' } as unknown as Band;
      mockBandRepository.findOne.mockResolvedValue(band);

      const result = await service.findBySlug('b-band');

      expect(mockBandRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'b-band' } });
      expect(result).toEqual(band);
    });

    it('should throw NotFoundException if band not found by slug', async () => {
      mockBandRepository.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('b-band')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should successfully update band properties and regenerate slug', async () => {
      const existing = { id: '1', name: 'Old Band', slug: 'old-band', genres: [] } as unknown as Band;
      const dto = { name: 'New Band' };
      const updated = { id: '1', name: 'New Band', slug: 'new-band', genres: [] } as unknown as Band;

      mockBandRepository.findOne
        .mockResolvedValueOnce(existing) // findOne in update
        .mockResolvedValueOnce(null);    // duplicate slug check findOne

      mockBandRepository.save.mockResolvedValue(updated);

      const result = await service.update('1', dto);

      expect(mockBandRepository.save).toHaveBeenCalledWith(updated);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should successfully delete a band', async () => {
      const band = { id: '1', name: 'B Band' } as unknown as Band;
      mockBandRepository.findOne.mockResolvedValue(band);
      mockBandRepository.remove.mockResolvedValue(band);

      await service.remove('1');

      expect(mockBandRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockBandRepository.remove).toHaveBeenCalledWith(band);
    });
  });

  describe('findOrCreateManyByName', () => {
    it('should return empty list on empty inputs', async () => {
      const result = await service.findOrCreateManyByName([]);
      expect(result).toEqual([]);
    });

    it('should find existing and create missing bands', async () => {
      const existing = { id: 'uuid-1', name: 'The Floozies', slug: 'the-floozies' } as unknown as Band;
      const created = { id: 'uuid-2', name: 'Defunk', slug: 'defunk' } as unknown as Band;

      mockQueryBuilder.getMany.mockResolvedValue([existing]);
      mockBandRepository.findOne.mockResolvedValue(null);
      mockBandRepository.create.mockReturnValue(created);
      mockBandRepository.save.mockResolvedValue(created);

      const result = await service.findOrCreateManyByName(['The Floozies', 'Defunk']);

      expect(result).toEqual([existing, created]);
    });
  });
});
