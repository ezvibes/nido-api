import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Concert } from './entities/concert.entity';
import { User } from '../users/entities/user.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { ListConcertsDto } from './dto/list-concerts.dto';
import { Artist, ArtistDto } from './dto/artist.dto';
import { Venue, VenueDto } from './dto/venue.dto';

@Injectable()
export class ConcertService {
  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
  ) {}

  async findAllForOwner(owner: User, query: ListConcertsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.owner_id = :ownerId', { ownerId: owner.id });

    if (query.q) {
      qb.andWhere(
        '(concert.title ILIKE :q OR concert.description ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (query.genre) {
      qb.andWhere('concert.genre = :genre', { genre: query.genre });
    }

    if (query.startsAfter) {
      qb.andWhere('concert.starts_at >= :startsAfter', {
        startsAfter: query.startsAfter,
      });
    }

    if (query.startsBefore) {
      qb.andWhere('concert.starts_at <= :startsBefore', {
        startsBefore: query.startsBefore,
      });
    }

    const [data, total] = await qb
      .orderBy('concert.starts_at', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total, page, pageSize };
  }

  async createForOwner(owner: User, dto: CreateConcertDto) {
    const concert = this.concertRepository.create({
      owner,
      title: this.normalizeRequiredString(dto.title),
      genre: this.normalizeRequiredString(dto.genre),
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      venues: dto.venues.map((venue) => this.normalizeVenue(venue)),
      artists: dto.artists.map((artist) => this.normalizeArtist(artist)),
      description: this.normalizeOptionalString(dto.description),
    });

    return this.concertRepository.save(concert);
  }

  async findOneForOwner(id: string, owner: User) {
    const concert = await this.concertRepository.findOne({
      where: { id, owner: { id: owner.id } },
      relations: ['owner'],
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    return concert;
  }

  async updateForOwner(id: string, owner: User, dto: UpdateConcertDto) {
    const concert = await this.findOneForOwner(id, owner);

    if (dto.title !== undefined) {
      concert.title = this.normalizeRequiredString(dto.title);
    }

    if (dto.genre !== undefined) {
      concert.genre = this.normalizeRequiredString(dto.genre);
    }

    if (dto.startsAt !== undefined) {
      concert.startsAt = new Date(dto.startsAt);
    }

    if (dto.endsAt !== undefined) {
      concert.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }

    if (dto.venues !== undefined) {
      concert.venues = dto.venues.map((venue) => this.normalizeVenue(venue));
    }

    if (dto.artists !== undefined) {
      concert.artists = dto.artists.map((artist) => this.normalizeArtist(artist));
    }

    if (dto.description !== undefined) {
      concert.description = this.normalizeOptionalString(dto.description);
    }

    return this.concertRepository.save(concert);
  }

  async removeForOwner(id: string, owner: User) {
    const concert = await this.findOneForOwner(id, owner);
    await this.concertRepository.remove(concert);
  }

  private normalizeRequiredString(value: string) {
    return value.trim();
  }

  private normalizeOptionalString(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeVenue(venue: VenueDto): Venue {
    return {
      name: this.normalizeRequiredString(venue.name),
      city: venue.city?.trim() || undefined,
      state: venue.state?.trim() || undefined,
      country: venue.country?.trim() || undefined,
    };
  }

  private normalizeArtist(artist: ArtistDto): Artist {
    return {
      name: this.normalizeRequiredString(artist.name),
      role: artist.role?.trim() || undefined,
      genre: artist.genre?.trim() || undefined,
    };
  }
}
