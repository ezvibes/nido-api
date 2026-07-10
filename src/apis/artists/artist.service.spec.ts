import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ArtistService } from './artist.service';
import { Artist } from './entities/artist.entity';

describe('ArtistService', () => {
  let service: ArtistService;
  let repository: Repository<Artist>;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockArtistRepository = {
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
        ArtistService,
        {
          provide: getRepositoryToken(Artist),
          useValue: mockArtistRepository,
        },
      ],
    }).compile();

    service = module.get<ArtistService>(ArtistService);
    repository = module.get<Repository<Artist>>(getRepositoryToken(Artist));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create and save an artist with auto-generated slug', async () => {
      const dto = { name: 'The Floozies', genres: ['Electronic', 'Funk'] };
      const artist = { id: 'uuid', ...dto, slug: 'the-floozies' } as unknown as Artist;

      mockArtistRepository.findOne.mockResolvedValue(null);
      mockArtistRepository.create.mockReturnValue(artist);
      mockArtistRepository.save.mockResolvedValue(artist);

      const result = await service.create(dto);

      expect(mockArtistRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'the-floozies' } });
      expect(mockArtistRepository.create).toHaveBeenCalledWith({
        ...dto,
        slug: 'the-floozies',
        genres: ['electronic', 'funk'],
      });
      expect(mockArtistRepository.save).toHaveBeenCalledWith(artist);
      expect(result).toEqual(artist);
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto = { name: 'The Floozies' };
      mockArtistRepository.findOne.mockResolvedValue({ id: 'existing-id' } as unknown as Artist);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should query and return artists list', async () => {
      const artists = [{ id: '1', name: 'B Band' }, { id: '2', name: 'A Band' }];
      mockQueryBuilder.getMany.mockResolvedValue(artists);

      const result = await service.findAll({ q: 'Band', genre: 'Funk', isFeatured: true });

      expect(mockArtistRepository.createQueryBuilder).toHaveBeenCalledWith('artist');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('artist.name ILIKE :q', { q: '%Band%' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(':genre = ANY(artist.genres)', { genre: 'funk' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('artist.isFeatured = :isFeatured', { isFeatured: true });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('artist.name', 'ASC');
      expect(result).toEqual(artists);
    });
  });

  describe('findOne', () => {
    it('should return artist by id', async () => {
      const artist = { id: '1', name: 'B Band' } as unknown as Artist;
      mockArtistRepository.findOne.mockResolvedValue(artist);

      const result = await service.findOne('1');

      expect(mockArtistRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(artist);
    });

    it('should throw NotFoundException if artist not found by id', async () => {
      mockArtistRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return artist by slug', async () => {
      const artist = { id: '1', name: 'B Band', slug: 'b-band' } as unknown as Artist;
      mockArtistRepository.findOne.mockResolvedValue(artist);

      const result = await service.findBySlug('b-band');

      expect(mockArtistRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'b-band' } });
      expect(result).toEqual(artist);
    });

    it('should throw NotFoundException if artist not found by slug', async () => {
      mockArtistRepository.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('b-band')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should successfully update artist properties and regenerate slug', async () => {
      const existing = { id: '1', name: 'Old Band', slug: 'old-band', genres: [] } as unknown as Artist;
      const dto = { name: 'New Band' };
      const updated = { id: '1', name: 'New Band', slug: 'new-band', genres: [] } as unknown as Artist;

      mockArtistRepository.findOne
        .mockResolvedValueOnce(existing) // findOne in update
        .mockResolvedValueOnce(null);    // duplicate slug check findOne

      mockArtistRepository.save.mockResolvedValue(updated);

      const result = await service.update('1', dto);

      expect(mockArtistRepository.save).toHaveBeenCalledWith(updated);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should successfully delete an artist', async () => {
      const artist = { id: '1', name: 'B Band' } as unknown as Artist;
      mockArtistRepository.findOne.mockResolvedValue(artist);
      mockArtistRepository.remove.mockResolvedValue(artist);

      await service.remove('1');

      expect(mockArtistRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockArtistRepository.remove).toHaveBeenCalledWith(artist);
    });
  });
});
