import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from './entities/artist.entity';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

@Injectable()
export class ArtistService {
  constructor(
    @InjectRepository(Artist)
    private readonly artistRepository: Repository<Artist>,
  ) {}

  async create(dto: CreateArtistDto): Promise<Artist> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    
    const existing = await this.artistRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Artist with slug "${slug}" already exists`);
    }

    const artist = this.artistRepository.create({
      ...dto,
      slug,
      genres: dto.genres?.map(g => g.toLowerCase()) ?? [],
    });

    return this.artistRepository.save(artist);
  }

  async findAll(query?: { q?: string; genre?: string; isFeatured?: boolean }): Promise<Artist[]> {
    const qb = this.artistRepository.createQueryBuilder('artist');

    if (query?.q) {
      qb.andWhere('artist.name ILIKE :q', { q: `%${query.q}%` });
    }

    if (query?.genre) {
      qb.andWhere(':genre = ANY(artist.genres)', { genre: query.genre.toLowerCase() });
    }

    if (query?.isFeatured !== undefined) {
      qb.andWhere('artist.isFeatured = :isFeatured', { isFeatured: query.isFeatured });
    }

    qb.orderBy('artist.name', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string): Promise<Artist> {
    const artist = await this.artistRepository.findOne({ where: { id } });
    if (!artist) {
      throw new NotFoundException(`Artist with ID "${id}" not found`);
    }
    return artist;
  }

  async findBySlug(slug: string): Promise<Artist> {
    const artist = await this.artistRepository.findOne({ where: { slug } });
    if (!artist) {
      throw new NotFoundException(`Artist with slug "${slug}" not found`);
    }
    return artist;
  }

  async update(id: string, dto: UpdateArtistDto): Promise<Artist> {
    const artist = await this.findOne(id);

    if (dto.name && !dto.slug) {
      const newSlug = slugify(dto.name);
      if (newSlug !== artist.slug) {
        const existing = await this.artistRepository.findOne({ where: { slug: newSlug } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Artist with slug "${newSlug}" already exists`);
        }
        artist.slug = newSlug;
      }
    } else if (dto.slug) {
      const newSlug = slugify(dto.slug);
      if (newSlug !== artist.slug) {
        const existing = await this.artistRepository.findOne({ where: { slug: newSlug } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Artist with slug "${newSlug}" already exists`);
        }
        artist.slug = newSlug;
      }
    }

    this.artistRepository.merge(artist, {
      ...dto,
      genres: dto.genres?.map(g => g.toLowerCase()) ?? artist.genres,
    });

    return this.artistRepository.save(artist);
  }

  async remove(id: string): Promise<void> {
    const artist = await this.findOne(id);
    await this.artistRepository.remove(artist);
  }
}
