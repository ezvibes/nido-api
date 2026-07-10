import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { Venue } from '../venues/entities/venue.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Venue)
    private readonly venueRepository: Repository<Venue>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const venue = await this.venueRepository.findOne({ where: { id: dto.venueId } });
    if (!venue) {
      throw new BadRequestException(`Venue with ID "${dto.venueId}" does not exist`);
    }

    const event = this.eventRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      dateTime: new Date(dto.dateTime),
      ticketUrl: dto.ticketUrl?.trim(),
      venueId: dto.venueId,
      venue,
    });

    return this.eventRepository.save(event);
  }

  async findAll(query?: { q?: string; venueId?: string; startsAfter?: string; startsBefore?: string }): Promise<Event[]> {
    const qb = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.venue', 'venue');

    if (query?.q) {
      qb.andWhere('(event.title ILIKE :q OR event.description ILIKE :q)', { q: `%${query.q}%` });
    }

    if (query?.venueId) {
      qb.andWhere('event.venueId = :venueId', { venueId: query.venueId });
    }

    if (query?.startsAfter) {
      qb.andWhere('event.dateTime >= :startsAfter', { startsAfter: new Date(query.startsAfter) });
    }

    if (query?.startsBefore) {
      qb.andWhere('event.dateTime <= :startsBefore', { startsBefore: new Date(query.startsBefore) });
    }

    qb.orderBy('event.dateTime', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['venue'],
    });
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);

    if (dto.venueId && dto.venueId !== event.venueId) {
      const venue = await this.venueRepository.findOne({ where: { id: dto.venueId } });
      if (!venue) {
        throw new BadRequestException(`Venue with ID "${dto.venueId}" does not exist`);
      }
      event.venue = venue;
      event.venueId = dto.venueId;
    }

    this.eventRepository.merge(event, {
      title: dto.title?.trim() ?? event.title,
      description: dto.description !== undefined ? dto.description.trim() : event.description,
      dateTime: dto.dateTime ? new Date(dto.dateTime) : event.dateTime,
      ticketUrl: dto.ticketUrl !== undefined ? dto.ticketUrl.trim() : event.ticketUrl,
    });

    return this.eventRepository.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
  }
}
