import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Band } from './entities/band.entity';
import { CreateBandDto } from './dto/create-band.dto';
import { UpdateBandDto } from './dto/update-band.dto';

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
export class BandService {
  constructor(
    @InjectRepository(Band)
    private readonly bandRepository: Repository<Band>,
  ) {}

  async create(dto: CreateBandDto): Promise<Band> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    
    const existing = await this.bandRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Band with slug "${slug}" already exists`);
    }

    const band = this.bandRepository.create({
      ...dto,
      slug,
      genres: dto.genres?.map(g => g.toLowerCase()) ?? [],
    });

    return this.bandRepository.save(band);
  }

  async findAll(query?: { q?: string; genre?: string; isFeatured?: boolean }): Promise<Band[]> {
    const qb = this.bandRepository.createQueryBuilder('band');

    if (query?.q) {
      qb.andWhere('band.name ILIKE :q', { q: `%${query.q}%` });
    }

    if (query?.genre) {
      qb.andWhere(':genre = ANY(band.genres)', { genre: query.genre.toLowerCase() });
    }

    if (query?.isFeatured !== undefined) {
      qb.andWhere('band.isFeatured = :isFeatured', { isFeatured: query.isFeatured });
    }

    qb.orderBy('band.name', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string): Promise<Band> {
    const band = await this.bandRepository.findOne({ where: { id } });
    if (!band) {
      throw new NotFoundException(`Band with ID "${id}" not found`);
    }
    return band;
  }

  async findBySlug(slug: string): Promise<Band> {
    const band = await this.bandRepository.findOne({ where: { slug } });
    if (!band) {
      throw new NotFoundException(`Band with slug "${slug}" not found`);
    }
    return band;
  }

  async update(id: string, dto: UpdateBandDto): Promise<Band> {
    const band = await this.findOne(id);

    if (dto.name && !dto.slug) {
      const newSlug = slugify(dto.name);
      if (newSlug !== band.slug) {
        const existing = await this.bandRepository.findOne({ where: { slug: newSlug } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Band with slug "${newSlug}" already exists`);
        }
        band.slug = newSlug;
      }
    } else if (dto.slug) {
      const newSlug = slugify(dto.slug);
      if (newSlug !== band.slug) {
        const existing = await this.bandRepository.findOne({ where: { slug: newSlug } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Band with slug "${newSlug}" already exists`);
        }
        band.slug = newSlug;
      }
    }

    this.bandRepository.merge(band, {
      ...dto,
      genres: dto.genres?.map(g => g.toLowerCase()) ?? band.genres,
    });

    return this.bandRepository.save(band);
  }

  async remove(id: string): Promise<void> {
    const band = await this.findOne(id);
    await this.bandRepository.remove(band);
  }

  async findOrCreateManyByName(names: string[]): Promise<Band[]> {
    if (!names || names.length === 0) return [];

    const normalizedNames = names
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (normalizedNames.length === 0) return [];

    const existing = await this.bandRepository
      .createQueryBuilder('band')
      .where('LOWER(band.name) IN (:...names)', {
        names: normalizedNames.map((n) => n.toLowerCase()),
      })
      .getMany();

    const existingMap = new Map(existing.map((b) => [b.name.toLowerCase(), b]));
    const results: Band[] = [];

    for (const name of normalizedNames) {
      const lowerName = name.toLowerCase();
      const found = existingMap.get(lowerName);
      if (found) {
        results.push(found);
      } else {
        let baseSlug = slugify(name);
        if (!baseSlug) {
          baseSlug = 'band';
        }
        let slug = baseSlug;
        let counter = 1;
        while (await this.bandRepository.findOne({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const newBand = this.bandRepository.create({
          name,
          slug,
          genres: [],
        });
        const saved = await this.bandRepository.save(newBand);
        results.push(saved);
        existingMap.set(lowerName, saved);
      }
    }

    return results;
  }
}
