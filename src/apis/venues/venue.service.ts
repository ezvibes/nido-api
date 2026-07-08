import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from './entities/venue.entity';

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue)
    private readonly venueRepository: Repository<Venue>,
  ) {}

  async create(venueData: Partial<Venue>): Promise<Venue> {
    const venue = this.venueRepository.create(venueData);
    return this.venueRepository.save(venue);
  }

  async findAll(): Promise<Venue[]> {
    return this.venueRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venueRepository.findOne({ where: { id } });
    if (!venue) {
      throw new NotFoundException(`Venue with ID ${id} not found`);
    }
    return venue;
  }

  async findByCity(citySlug: string): Promise<Venue[]> {
    return this.venueRepository.find({
      where: { citySlug },
      order: { name: 'ASC' },
    });
  }

  async findByNameAndCity(name: string, citySlug: string): Promise<Venue | null> {
    return this.venueRepository.findOne({
      where: { name, citySlug },
    });
  }
}
