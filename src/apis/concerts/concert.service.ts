import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertUpvote } from './entities/concert-upvote.entity';
import { User } from '../users/entities/user.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { ListConcertsDto } from './dto/list-concerts.dto';
import { Venue } from '../venues/entities/venue.entity';
import { Band } from '../bands/entities/band.entity';
import { ConcertBandLineup, PerformanceRole } from './entities/concert-band-lineup.entity';
import { ConcertSet } from './entities/concert-set.entity';

export interface ConcertEngagement {
  upvoteCount: number;
  upvotedByMe: boolean;
  trendingWeekUpvotes: number;
}

export interface ConcertSyncSource {
  source: 'google_calendar';
  calendarId: string;
  calendarEventId: string;
  lastSyncedAt?: Date | null;
  needsGuidance?: boolean;
}

@Injectable()
export class ConcertService {
  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    @InjectRepository(ConcertUpvote)
    private readonly concertUpvoteRepository: Repository<ConcertUpvote>,
  ) {}

  async findAll(query: ListConcertsDto, currentUser?: User) {
    const qb = this.concertRepository.createQueryBuilder('concert');
    return this.findWithQuery(qb, query, currentUser);
  }

  async findAllForOwner(owner: User, query: ListConcertsDto) {
    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.owner_id = :ownerId', { ownerId: owner.id });
    return this.findWithQuery(qb, query, owner);
  }

  private async findWithQuery(
    qb: ReturnType<Repository<Concert>['createQueryBuilder']>,
    query: ListConcertsDto,
    currentUser?: User,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    qb.leftJoinAndSelect('concert.venue', 'venue')
      .leftJoinAndSelect('concert.lineup', 'lineup')
      .leftJoinAndSelect('lineup.band', 'band')
      .leftJoinAndSelect('concert.sets', 'set')
      .leftJoinAndSelect('set.band', 'setBand');

    if (query.q) {
      qb.andWhere(
        `(
          concert.title ILIKE :q
          OR concert.description ILIKE :q
          OR venue.name ILIKE :q
          OR band.name ILIKE :q
        )`,
        {
          q: `%${query.q}%`,
        },
      );
    }

    if (query.genre) {
      qb.andWhere('concert.genre = :genre', { genre: query.genre });
    }

    if (query.startsAfter) {
      qb.andWhere('concert.startsAt >= :startsAfter', {
        startsAfter: query.startsAfter,
      });
    }

    if (query.startsBefore) {
      qb.andWhere('concert.startsAt <= :startsBefore', {
        startsBefore: query.startsBefore,
      });
    }

    const total = await qb.clone().getCount();
    const trendingSince = this.getTrendingSince();
    const currentUserId = currentUser?.id ?? null;

    // Engagement and sync metadata are read-only decorations on the shared list.
    qb.leftJoin('concert_upvotes', 'upvote', 'upvote.concert_id = concert.id')
      .leftJoin(
        'concert_sync_events',
        'syncEvent',
        'syncEvent.concert_id = concert.id',
      )
      .leftJoin(
        'concert_uploads',
        'upload',
        'upload.concert_id = concert.id',
      )
      .leftJoin(
        'concert_upvotes',
        'myUpvote',
        'myUpvote.concert_id = concert.id AND myUpvote.user_id = :currentUserId',
        { currentUserId },
      )
      .addSelect('COUNT(DISTINCT upvote.id)', 'upvote_count')
      .addSelect(
        'COUNT(DISTINCT upvote.id) FILTER (WHERE upvote.created_at >= :trendingSince)',
        'trending_week_upvotes',
      )
      .addSelect('COUNT(DISTINCT myUpvote.id)', 'upvoted_by_me_count')
      .addSelect('MAX(syncEvent.calendar_id)', 'sync_calendar_id')
      .addSelect('MAX(syncEvent.calendar_event_id)', 'sync_calendar_event_id')
      .addSelect('MAX(syncEvent.last_synced_at)', 'sync_last_synced_at')
      .addSelect('BOOL_OR(syncEvent.needs_guidance)', 'sync_needs_guidance')
      .addSelect('MAX(upload.id::text)', 'upload_id')
      .setParameter('trendingSince', trendingSince)
      .groupBy('concert.id');

    if (query.sort === 'trending_week') {
      qb.orderBy('trending_week_upvotes', 'DESC')
        .addOrderBy('upvote_count', 'DESC')
        .addOrderBy('concert.startsAt', 'ASC');
    } else if (query.sort === 'featured' || query.sort === 'top_picks') {
      qb.orderBy('concert.isTopPick', 'DESC')
        .addOrderBy('concert.topPickScore', 'DESC', 'NULLS LAST')
        .addOrderBy('concert.startsAt', 'ASC');
    } else {
      qb.orderBy('concert.startsAt', 'ASC');
    }

    const { entities, raw } = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawAndEntities();

    const rawByConcertId = new Map<string, Record<string, unknown>>(
      raw.map((row) => {
        const typedRow = row as Record<string, unknown>;
        return [String(typedRow.concert_id), typedRow];
      }),
    );

    const data = entities.map((concert) =>
      this.withEngagement(
        concert,
        this.mapRawEngagement(rawByConcertId.get(concert.id)),
        this.mapRawSyncSource(rawByConcertId.get(concert.id)),
        this.mapRawPosterUrl(rawByConcertId.get(concert.id)),
      ),
    );

    return { data, total, page, pageSize };
  }

  async createForOwner(owner: User, dto: CreateConcertDto) {
    const venue = dto.venueId ? { id: dto.venueId } as Venue : null;

    let lineup: ConcertBandLineup[] = [];
    if (dto.lineup && dto.lineup.length > 0) {
      lineup = dto.lineup.map((item) => {
        const cbl = new ConcertBandLineup();
        cbl.bandId = item.bandId;
        cbl.band = { id: item.bandId } as Band;
        cbl.performanceRole = item.role ?? PerformanceRole.SUPPORT;
        cbl.performanceOrder = item.order ?? 0;
        return cbl;
      });
    } else if (dto.bandIds && dto.bandIds.length > 0) {
      lineup = dto.bandIds.map((id, index) => {
        const cbl = new ConcertBandLineup();
        cbl.bandId = id;
        cbl.band = { id } as Band;
        cbl.performanceRole = PerformanceRole.HEADLINER;
        cbl.performanceOrder = index;
        return cbl;
      });
    }

    let sets: ConcertSet[] = [];
    if (dto.sets && dto.sets.length > 0) {
      sets = dto.sets.map((setDto) => {
        const cs = new ConcertSet();
        cs.bandId = setDto.bandId;
        cs.band = { id: setDto.bandId } as Band;
        cs.stageName = setDto.stageName;
        cs.startsAt = new Date(setDto.startsAt);
        cs.endsAt = new Date(setDto.endsAt);
        return cs;
      });
    }

    const concert = this.concertRepository.create({
      owner,
      title: this.normalizeRequiredString(dto.title),
      genre: this.normalizeRequiredString(dto.genre),
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      venue,
      lineup,
      sets,
      description: this.normalizeOptionalString(dto.description),
    });

    const savedConcert = await this.concertRepository.save(concert);
    const reloaded = await this.concertRepository.findOne({
      where: { id: savedConcert.id },
      relations: ['venue', 'lineup', 'sets'],
    });

    return this.withEngagement(reloaded!, {
      upvoteCount: 0,
      upvotedByMe: false,
      trendingWeekUpvotes: 0,
    });
  }

  async findOneForOwner(id: string, owner: User) {
    const concert = await this.concertRepository.findOne({
      where: { id, owner: { id: owner.id } },
      relations: ['owner', 'venue', 'lineup', 'sets'],
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

    if (dto.venueId !== undefined) {
      concert.venue = dto.venueId ? { id: dto.venueId } as Venue : null;
    }

    if (dto.lineup !== undefined || dto.bandIds !== undefined) {
      await this.concertRepository.manager.delete(ConcertBandLineup, { concertId: concert.id });

      let lineup: ConcertBandLineup[] = [];
      if (dto.lineup && dto.lineup.length > 0) {
        lineup = dto.lineup.map((item) => {
          const cbl = new ConcertBandLineup();
          cbl.concertId = concert.id;
          cbl.bandId = item.bandId;
          cbl.band = { id: item.bandId } as Band;
          cbl.performanceRole = item.role ?? PerformanceRole.SUPPORT;
          cbl.performanceOrder = item.order ?? 0;
          return cbl;
        });
      } else if (dto.bandIds && dto.bandIds.length > 0) {
        lineup = dto.bandIds.map((id, index) => {
          const cbl = new ConcertBandLineup();
          cbl.concertId = concert.id;
          cbl.bandId = id;
          cbl.band = { id } as Band;
          cbl.performanceRole = PerformanceRole.HEADLINER;
          cbl.performanceOrder = index;
          return cbl;
        });
      }
      concert.lineup = lineup;
    }

    if (dto.sets !== undefined) {
      await this.concertRepository.manager.delete(ConcertSet, { concertId: concert.id });

      let sets: ConcertSet[] = [];
      if (dto.sets && dto.sets.length > 0) {
        sets = dto.sets.map((setDto) => {
          const cs = new ConcertSet();
          cs.concertId = concert.id;
          cs.bandId = setDto.bandId;
          cs.band = { id: setDto.bandId } as Band;
          cs.stageName = setDto.stageName;
          cs.startsAt = new Date(setDto.startsAt);
          cs.endsAt = new Date(setDto.endsAt);
          return cs;
        });
      }
      concert.sets = sets;
    }

    if (dto.description !== undefined) {
      concert.description = this.normalizeOptionalString(dto.description);
    }

    const saved = await this.concertRepository.save(concert);
    const engagement = await this.getEngagement(saved.id, owner);
    const reloaded = await this.concertRepository.findOne({
      where: { id: saved.id },
      relations: ['owner', 'venue', 'lineup', 'sets'],
    });

    return this.withEngagement(reloaded!, engagement);
  }

  async removeForOwner(id: string, owner: User) {
    const concert = await this.findOneForOwner(id, owner);
    await this.concertRepository.remove(concert);
  }

  async setAdminApproval(id: string, reviewer: User, approved: boolean) {
    const concert = await this.findOne(id);

    concert.isAdminApproved = approved;
    concert.adminApprovedAt = approved ? new Date() : null;
    concert.adminApprovedByUserId = approved ? reviewer.id : null;

    if (!approved) {
      concert.isTopPick = false;
      concert.topPickScore = null;
      concert.topPickRefreshedAt = new Date();
    }

    return this.concertRepository.save(concert);
  }

  async upvote(id: string, user: User) {
    await this.findOne(id);

    await this.concertUpvoteRepository
      .createQueryBuilder()
      .insert()
      .into(ConcertUpvote)
      .values({
        concert: { id },
        user: { id: user.id },
      })
      .orIgnore()
      .execute();

    return this.getEngagement(id, user);
  }

  async removeUpvote(id: string, user: User) {
    await this.findOne(id);

    await this.concertUpvoteRepository
      .createQueryBuilder()
      .delete()
      .from(ConcertUpvote)
      .where('concert_id = :concertId', { concertId: id })
      .andWhere('user_id = :userId', { userId: user.id })
      .execute();

    return this.getEngagement(id, user);
  }

  private async findOne(id: string) {
    const concert = await this.concertRepository.findOne({
      where: { id },
      relations: ['venue', 'lineup', 'sets'],
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    return concert;
  }

  private async getEngagement(id: string, user: User) {
    const trendingSince = this.getTrendingSince();
    const raw = await this.concertUpvoteRepository
      .createQueryBuilder('upvote')
      .select('COUNT(DISTINCT upvote.id)', 'upvote_count')
      .addSelect(
        'COUNT(DISTINCT upvote.id) FILTER (WHERE upvote.created_at >= :trendingSince)',
        'trending_week_upvotes',
      )
      .addSelect('COUNT(DISTINCT myUpvote.id)', 'upvoted_by_me_count')
      .leftJoin(
        ConcertUpvote,
        'myUpvote',
        'myUpvote.concert_id = :concertId AND myUpvote.user_id = :userId',
        { concertId: id, userId: user.id },
      )
      .where('upvote.concert_id = :concertId', { concertId: id })
      .setParameter('trendingSince', trendingSince)
      .getRawOne<Record<string, unknown>>();

    return {
      concertId: id,
      ...this.mapRawEngagement(raw),
    };
  }

  private getTrendingSince() {
    const trendingSince = new Date();
    trendingSince.setDate(trendingSince.getDate() - 7);
    return trendingSince;
  }

  private mapRawEngagement(raw?: Record<string, unknown>): ConcertEngagement {
    return {
      upvoteCount: Number(raw?.upvote_count ?? 0),
      upvotedByMe: Number(raw?.upvoted_by_me_count ?? 0) > 0,
      trendingWeekUpvotes: Number(raw?.trending_week_upvotes ?? 0),
    };
  }

  private mapRawSyncSource(
    raw?: Record<string, unknown>,
  ): ConcertSyncSource | null {
    const calendarId = raw?.sync_calendar_id;
    const calendarEventId = raw?.sync_calendar_event_id;
    if (!calendarId || !calendarEventId) {
      return null;
    }

    return {
      source: 'google_calendar',
      calendarId: String(calendarId),
      calendarEventId: String(calendarEventId),
      lastSyncedAt: raw?.sync_last_synced_at
        ? new Date(String(raw.sync_last_synced_at))
        : null,
      needsGuidance: raw?.sync_needs_guidance === true,
    };
  }

  private mapRawPosterUrl(raw?: Record<string, unknown>): string | null {
    const uploadId = raw?.upload_id;
    if (!uploadId) {
      return null;
    }
    return `/ingestion/uploads/${uploadId}/image`;
  }

  private withEngagement<T extends Concert>(
    concert: T,
    engagement: ConcertEngagement,
    syncSource: ConcertSyncSource | null = null,
    posterUrl: string | null = null,
  ) {
    return {
      ...concert,
      ...engagement,
      syncSource,
      posterUrl,
    };
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
}
