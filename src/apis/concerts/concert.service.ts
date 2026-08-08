import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Concert, ConcertCatalogStatus } from './entities/concert.entity';
import { ConcertUpvote } from './entities/concert-upvote.entity';
import { User } from '../users/entities/user.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { ListConcertsDto } from './dto/list-concerts.dto';
import { Venue } from '../venues/entities/venue.entity';
import { Band } from '../bands/entities/band.entity';
import {
  ConcertBandLineup,
  PerformanceRole,
} from './entities/concert-band-lineup.entity';
import { ConcertSet } from './entities/concert-set.entity';
import {
  AdminConcertCatalogFilter,
  ListAdminConcertsDto,
} from './dto/list-admin-concerts.dto';
import { UpdateAdminConcertDto } from './dto/update-admin-concert.dto';

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
    private readonly configService: ConfigService,
  ) {}

  async findAll(query: ListConcertsDto, currentUser?: User) {
    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.catalogStatus = :activeCatalogStatus', {
        activeCatalogStatus: ConcertCatalogStatus.ACTIVE,
      });
    return this.findWithQuery(qb, query, currentUser);
  }

  async findAllForOwner(owner: User, query: ListConcertsDto) {
    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.owner_id = :ownerId', { ownerId: owner.id });
    return this.findWithQuery(qb, query, owner);
  }

  async findAllAdmin(query: ListAdminConcertsDto) {
    const qb = this.concertRepository.createQueryBuilder('concert');

    if (
      query.catalogStatus &&
      query.catalogStatus !== AdminConcertCatalogFilter.ALL
    ) {
      qb.where('concert.catalogStatus = :catalogStatus', {
        catalogStatus: query.catalogStatus,
      });
    }

    if (query.isFeatured !== undefined) {
      qb.andWhere('concert.isFeatured = :isFeatured', {
        isFeatured: query.isFeatured,
      });
    }

    return this.findWithQuery(qb, query, undefined, true);
  }

  async findAvailableGenres(): Promise<string[]> {
    const rows = await this.concertRepository
      .createQueryBuilder('concert')
      .select('DISTINCT TRIM(concert.genre)', 'genre')
      .where('concert.catalogStatus = :activeCatalogStatus', {
        activeCatalogStatus: ConcertCatalogStatus.ACTIVE,
      })
      .andWhere('concert.genre IS NOT NULL')
      .andWhere("TRIM(concert.genre) <> ''")
      .getRawMany<{ genre: string | null }>();

    const genres = new Map<string, string>();
    const configuredGenres =
      this.configService.get<string>('CONCERT_GENRE_OPTIONS') ?? '';

    for (const configuredGenre of configuredGenres.split(',')) {
      const genre = configuredGenre.trim();
      if (genre) {
        genres.set(genre.toLowerCase(), genre);
      }
    }

    for (const row of rows) {
      const genre = row.genre?.trim();
      const key = genre?.toLowerCase();
      if (genre && key && !genres.has(key)) {
        genres.set(key, genre);
      }
    }

    return Array.from(genres.values()).sort((a, b) => a.localeCompare(b));
  }

  private async findWithQuery(
    qb: ReturnType<Repository<Concert>['createQueryBuilder']>,
    query: ListConcertsDto,
    currentUser?: User,
    includeAdminMetadata = false,
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

    // Correlated subqueries decorate each concert without forcing the relation
    // columns selected above into a brittle GROUP BY clause.
    qb.addSelect(
      (subquery) =>
        subquery
          .select('COUNT(*)')
          .from('concert_upvotes', 'upvote')
          .where('upvote.concert_id = concert.id'),
      'upvote_count',
    )
      .addSelect(
        (subquery) =>
          subquery
            .select('COUNT(*)')
            .from('concert_upvotes', 'trendingUpvote')
            .where('trendingUpvote.concert_id = concert.id')
            .andWhere('trendingUpvote.created_at >= :trendingSince'),
        'trending_week_upvotes',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('COUNT(*)')
            .from('concert_upvotes', 'myUpvote')
            .where('myUpvote.concert_id = concert.id')
            .andWhere('myUpvote.user_id = :currentUserId'),
        'upvoted_by_me_count',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX(syncEvent.calendar_id)')
            .from('concert_sync_events', 'syncEvent')
            .where('syncEvent.concert_id = concert.id'),
        'sync_calendar_id',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX(syncEvent.calendar_event_id)')
            .from('concert_sync_events', 'syncEvent')
            .where('syncEvent.concert_id = concert.id'),
        'sync_calendar_event_id',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX(syncEvent.last_synced_at)')
            .from('concert_sync_events', 'syncEvent')
            .where('syncEvent.concert_id = concert.id'),
        'sync_last_synced_at',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('COALESCE(BOOL_OR(syncEvent.needs_guidance), false)')
            .from('concert_sync_events', 'syncEvent')
            .where('syncEvent.concert_id = concert.id'),
        'sync_needs_guidance',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX(upload.id::text)')
            .from('concert_uploads', 'upload')
            .where('upload.concert_id = concert.id'),
        'upload_id',
      )
      .setParameter('trendingSince', trendingSince)
      .setParameter('currentUserId', currentUserId);

    if (query.sort === 'trending_week') {
      qb.orderBy('trending_week_upvotes', 'DESC')
        .addOrderBy('upvote_count', 'DESC')
        .addOrderBy('concert.startsAt', 'ASC')
        .addOrderBy('concert.id', 'ASC');
    } else if (query.sort === 'featured') {
      qb.orderBy('concert.isFeatured', 'DESC')
        .addOrderBy('concert.startsAt', 'ASC')
        .addOrderBy('concert.id', 'ASC');
    } else if (query.sort === 'top_picks') {
      qb.orderBy('concert.isTopPick', 'DESC')
        .addOrderBy('concert.topPickScore', 'DESC', 'NULLS LAST')
        .addOrderBy('concert.startsAt', 'ASC')
        .addOrderBy('concert.id', 'ASC');
    } else {
      qb.orderBy('concert.startsAt', 'ASC').addOrderBy('concert.id', 'ASC');
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
        includeAdminMetadata,
      ),
    );

    return { data, total, page, pageSize };
  }

  async createForOwner(owner: User, dto: CreateConcertDto) {
    const venue = dto.venueId ? ({ id: dto.venueId } as Venue) : null;

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
    if (
      concert.catalogStatus !== ConcertCatalogStatus.ACTIVE ||
      concert.editorialLockedAt
    ) {
      throw new ConflictException(
        'This concert is under admin control and cannot be edited by its owner.',
      );
    }

    const saved = await this.concertRepository.manager.transaction(
      async (manager) => {
        const update: Partial<Concert> = {};
        if (dto.title !== undefined) {
          update.title = this.normalizeRequiredString(dto.title);
        }
        if (dto.genre !== undefined) {
          update.genre = this.normalizeRequiredString(dto.genre);
        }
        if (dto.startsAt !== undefined) {
          update.startsAt = new Date(dto.startsAt);
        }
        if (dto.endsAt !== undefined) {
          update.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
        }
        if (dto.venueId !== undefined) {
          update.venueId = dto.venueId;
        }
        if (dto.description !== undefined) {
          update.description = this.normalizeOptionalString(dto.description);
        }

        const claim = await manager
          .createQueryBuilder()
          .update(Concert)
          .set(update)
          .where('id = :id', { id: concert.id })
          .andWhere('owner_id = :ownerId', { ownerId: owner.id })
          .andWhere('version = :observedVersion', {
            observedVersion: concert.version,
          })
          .andWhere('catalog_status = :activeCatalogStatus', {
            activeCatalogStatus: ConcertCatalogStatus.ACTIVE,
          })
          .andWhere('editorial_locked_at IS NULL')
          .execute();

        if (claim.affected !== 1) {
          throw new ConflictException(
            'Concert changed while the update was being saved. Refresh and try again.',
          );
        }

        if (dto.lineup !== undefined || dto.bandIds !== undefined) {
          await manager.delete(ConcertBandLineup, { concertId: concert.id });
          const lineup = dto.lineup?.length
            ? dto.lineup.map((item) => {
                const entry = new ConcertBandLineup();
                entry.concertId = concert.id;
                entry.bandId = item.bandId;
                entry.band = { id: item.bandId } as Band;
                entry.performanceRole = item.role ?? PerformanceRole.SUPPORT;
                entry.performanceOrder = item.order ?? 0;
                return entry;
              })
            : (dto.bandIds ?? []).map((bandId, index) => {
                const entry = new ConcertBandLineup();
                entry.concertId = concert.id;
                entry.bandId = bandId;
                entry.band = { id: bandId } as Band;
                entry.performanceRole = PerformanceRole.HEADLINER;
                entry.performanceOrder = index;
                return entry;
              });
          if (lineup.length) {
            await manager.save(ConcertBandLineup, lineup);
          }
        }

        if (dto.sets !== undefined) {
          await manager.delete(ConcertSet, { concertId: concert.id });
          const sets = dto.sets.map((setDto) => {
            const set = new ConcertSet();
            set.concertId = concert.id;
            set.bandId = setDto.bandId;
            set.band = { id: setDto.bandId } as Band;
            set.stageName = setDto.stageName;
            set.startsAt = new Date(setDto.startsAt);
            set.endsAt = new Date(setDto.endsAt);
            return set;
          });
          if (sets.length) {
            await manager.save(ConcertSet, sets);
          }
        }

        return manager.findOneOrFail(Concert, {
          where: { id: concert.id, owner: { id: owner.id } },
          relations: ['owner', 'venue', 'lineup', 'sets'],
        });
      },
    );

    const engagement = await this.getEngagement(saved.id, owner);
    return this.withEngagement(saved, engagement, null, null, false);
  }

  async removeForOwner(id: string, owner: User) {
    const concert = await this.findOneForOwner(id, owner);
    const result = await this.concertRepository
      .createQueryBuilder()
      .delete()
      .from(Concert)
      .where('id = :id', { id: concert.id })
      .andWhere('owner_id = :ownerId', { ownerId: owner.id })
      .andWhere('version = :observedVersion', {
        observedVersion: concert.version,
      })
      .andWhere('catalog_status = :activeCatalogStatus', {
        activeCatalogStatus: ConcertCatalogStatus.ACTIVE,
      })
      .andWhere('editorial_locked_at IS NULL')
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException(
        'This concert changed or is under admin control and cannot be deleted by its owner.',
      );
    }
  }

  async setAdminApproval(id: string, reviewer: User, approved: boolean) {
    const concert = await this.findOne(id);
    const update: Partial<Concert> = {
      isAdminApproved: approved,
      adminApprovedAt: approved ? new Date() : null,
      adminApprovedByUserId: approved ? reviewer.id : null,
    };
    if (!approved) {
      update.isTopPick = false;
      update.topPickScore = null;
      update.topPickRefreshedAt = new Date();
    }

    const result = await this.concertRepository
      .createQueryBuilder()
      .update(Concert)
      .set(update)
      .where('id = :id', { id })
      .andWhere('version = :observedVersion', {
        observedVersion: concert.version,
      })
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException(
        'Concert changed while approval was being saved. Refresh and try again.',
      );
    }

    return this.findOneAdmin(id);
  }

  async findOneAdmin(id: string) {
    const qb = this.concertRepository
      .createQueryBuilder('concert')
      .where('concert.id = :id', { id });
    const result = await this.findWithQuery(
      qb,
      { page: 1, pageSize: 1 },
      undefined,
      true,
    );

    if (!result.data[0]) {
      throw new NotFoundException('Concert not found');
    }

    return result.data[0];
  }

  async updateAdmin(id: string, dto: UpdateAdminConcertDto) {
    const contentChanged =
      dto.title !== undefined ||
      dto.genre !== undefined ||
      dto.startsAt !== undefined ||
      dto.endsAt !== undefined ||
      dto.venueId !== undefined ||
      dto.description !== undefined;

    if (contentChanged && dto.resumeSyncUpdates) {
      throw new BadRequestException(
        'Edit concert content or resume calendar updates, not both at once',
      );
    }

    const concert = await this.findOne(id);

    if (concert.version !== dto.expectedVersion) {
      throw new ConflictException(
        'Concert changed after it was loaded. Refresh and try again.',
      );
    }

    const resultingStatus = dto.catalogStatus ?? concert.catalogStatus;
    if (
      dto.isFeatured === true &&
      resultingStatus !== ConcertCatalogStatus.ACTIVE
    ) {
      throw new BadRequestException('Only active concerts can be featured');
    }

    const update: Partial<Concert> = {};
    if (dto.title !== undefined) {
      update.title = this.normalizeRequiredString(dto.title);
    }
    if (dto.genre !== undefined) {
      update.genre = this.normalizeRequiredString(dto.genre);
    }
    if (dto.startsAt !== undefined) {
      update.startsAt = new Date(dto.startsAt);
    }
    if (dto.endsAt !== undefined) {
      update.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    if (dto.venueId !== undefined) {
      update.venueId = dto.venueId;
    }
    if (dto.description !== undefined) {
      update.description = this.normalizeOptionalString(dto.description);
    }
    if (contentChanged) {
      update.editorialLockedAt = new Date();
    } else if (dto.resumeSyncUpdates) {
      update.editorialLockedAt = null;
    }
    if (dto.catalogStatus !== undefined) {
      update.catalogStatus = dto.catalogStatus;
    }
    if (resultingStatus !== ConcertCatalogStatus.ACTIVE) {
      update.isFeatured = false;
    } else if (dto.isFeatured !== undefined) {
      update.isFeatured = dto.isFeatured;
    }

    const result = await this.concertRepository
      .createQueryBuilder()
      .update(Concert)
      .set(update)
      .where('id = :id', { id })
      .andWhere('version = :expectedVersion', {
        expectedVersion: dto.expectedVersion,
      })
      .execute();

    if (result.affected !== 1) {
      throw new ConflictException(
        'Concert changed while the update was being saved. Refresh and try again.',
      );
    }

    return this.findOneAdmin(id);
  }

  async upvote(id: string, user: User) {
    await this.findOnePublic(id);

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
    await this.findOnePublic(id);

    await this.concertUpvoteRepository
      .createQueryBuilder()
      .delete()
      .from(ConcertUpvote)
      .where('concert_id = :concertId', { concertId: id })
      .andWhere('user_id = :userId', { userId: user.id })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM concerts concert
          WHERE concert.id = :concertId
            AND concert.catalog_status = :activeCatalogStatus
        )`,
        { activeCatalogStatus: ConcertCatalogStatus.ACTIVE },
      )
      .execute();

    const engagement = await this.getEngagement(id, user);
    await this.findOnePublic(id);
    return engagement;
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

  private async findOnePublic(id: string) {
    const concert = await this.concertRepository.findOne({
      where: { id, catalogStatus: ConcertCatalogStatus.ACTIVE },
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
    includeAdminMetadata = true,
  ) {
    const response = {
      ...concert,
      ...engagement,
      syncSource,
      posterUrl,
    };

    if (includeAdminMetadata) {
      return response;
    }

    const {
      catalogStatus: _catalogStatus,
      editorialLockedAt: _editorialLockedAt,
      version: _version,
      ...publicResponse
    } = response;
    return publicResponse;
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
