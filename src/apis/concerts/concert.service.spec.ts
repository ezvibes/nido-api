import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConcertService } from './concert.service';
import { Concert, ConcertCatalogStatus } from './entities/concert.entity';
import { ConcertUpvote } from './entities/concert-upvote.entity';
import { User } from '../users/entities/user.entity';
import {
  AdminConcertCatalogFilter,
  ListAdminConcertsDto,
} from './dto/list-admin-concerts.dto';

const createQueryBuilderMock = () => {
  const qb: Record<string, jest.Mock> = {};
  [
    'where',
    'andWhere',
    'leftJoin',
    'leftJoinAndSelect',
    'addSelect',
    'setParameter',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'insert',
    'into',
    'values',
    'orIgnore',
    'delete',
    'from',
    'select',
    'update',
    'set',
  ].forEach((method) => {
    qb[method] = jest.fn().mockReturnValue(qb);
  });
  qb.clone = jest.fn().mockReturnValue(qb);
  qb.getCount = jest.fn();
  qb.getRawAndEntities = jest.fn();
  qb.getRawOne = jest.fn();
  qb.getRawMany = jest.fn();
  qb.getOne = jest.fn();
  qb.execute = jest.fn();
  return qb;
};

describe('ConcertService', () => {
  const concertRepository = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    manager: {
      delete: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
    },
  };
  const concertUpvoteRepository = {
    createQueryBuilder: jest.fn(),
  };
  const genreRepository = {
    find: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let service: ConcertService;
  const owner = { id: 3 } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(undefined);
    concertRepository.manager.transaction.mockImplementation(
      async (
        callback: (manager: typeof concertRepository.manager) => unknown,
      ) => callback(concertRepository.manager),
    );
    service = new ConcertService(
      concertRepository as any,
      concertUpvoteRepository as any,
      genreRepository as any,
      configService as any,
    );
  });

  it('returns concerts with engagement counts and trending ordering', async () => {
    const qb = createQueryBuilderMock();
    const concert = {
      id: 'concert-1',
      title: 'Show',
      genre: 'Rock',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      editorialLockedAt: new Date('2026-05-31T00:00:00.000Z'),
      version: 3,
      isFeatured: true,
      venue: {
        name: 'The Pour House',
        city: 'Raleigh',
        region: 'NC',
      },
      lineup: [
        {
          performanceOrder: 0,
          performanceRole: 'headliner',
          band: { name: 'Example Band', genres: ['Indie Rock'] },
        },
      ],
    } as unknown as Concert;
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(1);
    qb.getRawAndEntities.mockResolvedValue({
      entities: [concert],
      raw: [
        {
          concert_id: 'concert-1',
          upvote_count: '4',
          upvoted_by_me_count: '1',
          trending_week_upvotes: '2',
        },
      ],
    });

    const result = await service.findAllForOwner(owner, {
      sort: 'trending_week',
      page: 1,
      pageSize: 20,
    });

    expect(qb.leftJoin).not.toHaveBeenCalled();
    expect(qb.addSelect).toHaveBeenCalledTimes(8);
    expect(qb.groupBy).not.toHaveBeenCalled();
    expect(qb.orderBy).toHaveBeenCalledWith('trending_week_upvotes', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('concert.id', 'ASC');
    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'concert-1',
        upvoteCount: 4,
        upvotedByMe: true,
        trendingWeekUpvotes: 2,
        isFeatured: true,
        venue: expect.objectContaining({
          name: 'The Pour House',
          city: 'Raleigh',
          region: 'NC',
        }),
        lineup: [
          expect.objectContaining({
            performanceRole: 'headliner',
            band: expect.objectContaining({ name: 'Example Band' }),
          }),
        ],
      }),
    );
    expect(result.data[0]).not.toHaveProperty('venues');
    expect(result.data[0]).not.toHaveProperty('artists');
    expect(result.data[0]).not.toHaveProperty('catalogStatus');
    expect(result.data[0]).not.toHaveProperty('editorialLockedAt');
    expect(result.data[0]).not.toHaveProperty('version');
  });

  it('uses a null user parameter for anonymous shared-feed requests', async () => {
    const qb = createQueryBuilderMock();
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(0);
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAll({ sort: 'soonest', page: 1, pageSize: 20 });

    expect(qb.where).toHaveBeenCalledWith(
      'concert.catalogStatus = :activeCatalogStatus',
      { activeCatalogStatus: ConcertCatalogStatus.ACTIVE },
    );
    expect(qb.setParameter).toHaveBeenCalledWith('currentUserId', null);
    expect(qb.addSelect).toHaveBeenCalledTimes(8);
    expect(qb.groupBy).not.toHaveBeenCalled();
  });

  it('sorts manual Featured separately from algorithmic Top Picks', async () => {
    const featuredQb = createQueryBuilderMock();
    const topPicksQb = createQueryBuilderMock();
    concertRepository.createQueryBuilder
      .mockReturnValueOnce(featuredQb)
      .mockReturnValueOnce(topPicksQb);
    featuredQb.getCount.mockResolvedValue(0);
    featuredQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    topPicksQb.getCount.mockResolvedValue(0);
    topPicksQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAll({ sort: 'featured', page: 1, pageSize: 20 });
    await service.findAll({ sort: 'top_picks', page: 1, pageSize: 20 });

    expect(featuredQb.orderBy).toHaveBeenCalledWith(
      'concert.isFeatured',
      'DESC',
    );
    expect(topPicksQb.orderBy).toHaveBeenCalledWith(
      'concert.isTopPick',
      'DESC',
    );
  });

  it('sorts concerts by latest date or recently added', async () => {
    const latestQb = createQueryBuilderMock();
    const recentQb = createQueryBuilderMock();
    concertRepository.createQueryBuilder
      .mockReturnValueOnce(latestQb)
      .mockReturnValueOnce(recentQb);
    latestQb.getCount.mockResolvedValue(0);
    latestQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    recentQb.getCount.mockResolvedValue(0);
    recentQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAll({ sort: 'latest', page: 1, pageSize: 20 });
    await service.findAll({ sort: 'recently_added', page: 1, pageSize: 20 });

    expect(latestQb.orderBy).toHaveBeenCalledWith('concert.startsAt', 'DESC');
    expect(recentQb.orderBy).toHaveBeenCalledWith('concert.createdAt', 'DESC');
  });

  it('filters the admin catalog by hidden state', async () => {
    const qb = createQueryBuilderMock();
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(0);
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAllAdmin({
      catalogStatus: AdminConcertCatalogFilter.HIDDEN,
      page: 1,
      pageSize: 20,
    });

    expect(qb.where).toHaveBeenCalledWith(
      'concert.catalogStatus = :catalogStatus',
      { catalogStatus: ConcertCatalogStatus.HIDDEN },
    );
  });

  it('defaults the admin catalog to all states when no filter is supplied', async () => {
    const qb = createQueryBuilderMock();
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(0);
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAllAdmin({
      page: 1,
      pageSize: 20,
    } as ListAdminConcertsDto);

    expect(qb.where).not.toHaveBeenCalled();
  });

  it('returns complete decorated metadata for admin detail responses', async () => {
    const qb = createQueryBuilderMock();
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(1);
    qb.getRawAndEntities.mockResolvedValue({
      entities: [
        {
          id: 'concert-1',
          catalogStatus: ConcertCatalogStatus.HIDDEN,
          editorialLockedAt: new Date('2026-08-01T00:00:00.000Z'),
          version: 9,
        },
      ],
      raw: [
        {
          concert_id: 'concert-1',
          upvote_count: '5',
          upvoted_by_me_count: '0',
          trending_week_upvotes: '2',
          sync_calendar_id: 'primary',
          sync_calendar_event_id: 'event-1',
          upload_id: 'upload-1',
        },
      ],
    });

    const result = await service.findOneAdmin('concert-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'concert-1',
        catalogStatus: ConcertCatalogStatus.HIDDEN,
        version: 9,
        upvoteCount: 5,
        trendingWeekUpvotes: 2,
        syncSource: expect.objectContaining({ calendarEventId: 'event-1' }),
        posterUrl: '/ingestion/uploads/upload-1/image',
      }),
    );
  });

  it('archives a concert, clears Featured, and locks edited sync content', async () => {
    const updateQb = createQueryBuilderMock();
    const responseQb = createQueryBuilderMock();
    const concert = {
      id: 'concert-1',
      title: 'Original title',
      genre: 'Rock',
      version: 4,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isFeatured: true,
      editorialLockedAt: null,
    } as Concert;
    concertRepository.findOne.mockResolvedValue(concert);
    concertRepository.createQueryBuilder
      .mockReturnValueOnce(updateQb)
      .mockReturnValueOnce(responseQb);
    updateQb.execute.mockResolvedValue({ affected: 1 });
    responseQb.getCount.mockResolvedValue(1);
    responseQb.getRawAndEntities.mockResolvedValue({
      entities: [
        {
          ...concert,
          title: 'Editorial title',
          catalogStatus: ConcertCatalogStatus.ARCHIVED,
          isFeatured: false,
          editorialLockedAt: new Date(),
          version: 5,
        },
      ],
      raw: [{ concert_id: 'concert-1' }],
    });

    await service.updateAdmin('concert-1', {
      expectedVersion: 4,
      title: 'Editorial title',
      catalogStatus: ConcertCatalogStatus.ARCHIVED,
    });

    expect(updateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Editorial title',
        catalogStatus: ConcertCatalogStatus.ARCHIVED,
        isFeatured: false,
        editorialLockedAt: expect.any(Date),
      }),
    );
    expect(updateQb.andWhere).toHaveBeenCalledWith(
      'version = :expectedVersion',
      { expectedVersion: 4 },
    );
    expect(updateQb.setLock).toBeUndefined();
  });

  it('rejects a stale admin edit', async () => {
    concertRepository.findOne.mockResolvedValue({
      id: 'concert-1',
      version: 5,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
    });

    await expect(
      service.updateAdmin('concert-1', {
        expectedVersion: 4,
        title: 'Stale title',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(concertRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does not feature a hidden concert', async () => {
    concertRepository.findOne.mockResolvedValue({
      id: 'concert-1',
      version: 2,
      catalogStatus: ConcertCatalogStatus.HIDDEN,
      isFeatured: false,
    });

    await expect(
      service.updateAdmin('concert-1', {
        expectedVersion: 2,
        isFeatured: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a concert with empty engagement state', async () => {
    const savedConcert = {
      id: 'concert-1',
      title: 'Show',
      genre: 'Rock',
    } as Concert;
    concertRepository.create.mockImplementation((value) => value);
    concertRepository.save.mockResolvedValue(savedConcert);
    concertRepository.findOne.mockResolvedValue(savedConcert);

    const result = await service.createForOwner(owner, {
      title: ' Show ',
      genre: ' Rock ',
      startsAt: '2026-06-01T00:00:00.000Z',
      venueId: 'venue-uuid',
      bandIds: ['band-uuid'],
    });

    expect(concertRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner,
        title: 'Show',
        genre: 'Rock',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'concert-1',
        upvoteCount: 0,
        upvotedByMe: false,
        trendingWeekUpvotes: 0,
      }),
    );
  });

  it('deletes an owner concert only while the observed active record remains current', async () => {
    const deleteQb = createQueryBuilderMock();
    concertRepository.findOne.mockResolvedValue({
      id: 'concert-1',
      version: 6,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      editorialLockedAt: null,
    });
    concertRepository.createQueryBuilder.mockReturnValue(deleteQb);
    deleteQb.execute.mockResolvedValue({ affected: 1 });

    await service.removeForOwner('concert-1', owner);

    expect(deleteQb.delete).toHaveBeenCalled();
    expect(deleteQb.from).toHaveBeenCalledWith(Concert);
    expect(deleteQb.andWhere).toHaveBeenCalledWith(
      'version = :observedVersion',
      { observedVersion: 6 },
    );
    expect(deleteQb.andWhere).toHaveBeenCalledWith(
      'catalog_status = :activeCatalogStatus',
      { activeCatalogStatus: ConcertCatalogStatus.ACTIVE },
    );
    expect(deleteQb.andWhere).toHaveBeenCalledWith(
      'editorial_locked_at IS NULL',
    );
  });

  it('rejects owner deletion when an admin update wins the race', async () => {
    const deleteQb = createQueryBuilderMock();
    concertRepository.findOne.mockResolvedValue({
      id: 'concert-1',
      version: 6,
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      editorialLockedAt: null,
    });
    concertRepository.createQueryBuilder.mockReturnValue(deleteQb);
    deleteQb.execute.mockResolvedValue({ affected: 0 });

    await expect(
      service.removeForOwner('concert-1', owner),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('inserts one upvote per user and returns current engagement', async () => {
    const insertQb = createQueryBuilderMock();
    const engagementQb = createQueryBuilderMock();
    concertRepository.findOne.mockResolvedValue({ id: 'concert-1' });
    concertUpvoteRepository.createQueryBuilder
      .mockReturnValueOnce(insertQb)
      .mockReturnValueOnce(engagementQb);
    insertQb.execute.mockResolvedValue(undefined);
    engagementQb.getRawOne.mockResolvedValue({
      upvote_count: '1',
      upvoted_by_me_count: '1',
      trending_week_upvotes: '1',
    });

    const result = await service.upvote('concert-1', owner);

    expect(insertQb.insert).toHaveBeenCalled();
    expect(insertQb.into).toHaveBeenCalledWith(ConcertUpvote);
    expect(insertQb.values).toHaveBeenCalledWith({
      concert: { id: 'concert-1' },
      user: { id: owner.id },
    });
    expect(insertQb.orIgnore).toHaveBeenCalled();
    expect(result).toEqual({
      concertId: 'concert-1',
      upvoteCount: 1,
      upvotedByMe: true,
      trendingWeekUpvotes: 1,
    });
  });

  it('deletes the current user upvote and returns current engagement', async () => {
    const deleteQb = createQueryBuilderMock();
    const engagementQb = createQueryBuilderMock();
    concertRepository.findOne.mockResolvedValue({ id: 'concert-1' });
    concertUpvoteRepository.createQueryBuilder
      .mockReturnValueOnce(deleteQb)
      .mockReturnValueOnce(engagementQb);
    deleteQb.execute.mockResolvedValue(undefined);
    engagementQb.getRawOne.mockResolvedValue({
      upvote_count: '0',
      upvoted_by_me_count: '0',
      trending_week_upvotes: '0',
    });

    const result = await service.removeUpvote('concert-1', owner);

    expect(deleteQb.delete).toHaveBeenCalled();
    expect(deleteQb.from).toHaveBeenCalledWith(ConcertUpvote);
    expect(deleteQb.where).toHaveBeenCalledWith('concert_id = :concertId', {
      concertId: 'concert-1',
    });
    expect(deleteQb.andWhere).toHaveBeenCalledWith('user_id = :userId', {
      userId: owner.id,
    });
    expect(deleteQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('concert.catalog_status = :activeCatalogStatus'),
      { activeCatalogStatus: ConcertCatalogStatus.ACTIVE },
    );
    expect(result.upvotedByMe).toBe(false);
    expect(concertRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'concert-1',
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      },
    });
  });

  it.each(['hidden-concert', 'archived-concert'])(
    'does not expose %s through upvote deletion',
    async (concertId) => {
      concertRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeUpvote(concertId, owner),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(concertUpvoteRepository.createQueryBuilder).not.toHaveBeenCalled();
    },
  );

  it('does not return engagement when a concert becomes hidden during upvote deletion', async () => {
    const deleteQb = createQueryBuilderMock();
    const engagementQb = createQueryBuilderMock();
    concertRepository.findOne
      .mockResolvedValueOnce({ id: 'concert-1' })
      .mockResolvedValueOnce(null);
    concertUpvoteRepository.createQueryBuilder
      .mockReturnValueOnce(deleteQb)
      .mockReturnValueOnce(engagementQb);
    deleteQb.execute.mockResolvedValue({ affected: 0 });
    engagementQb.getRawOne.mockResolvedValue({
      upvote_count: '4',
      upvoted_by_me_count: '1',
      trending_week_upvotes: '2',
    });

    await expect(
      service.removeUpvote('concert-1', owner),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects upvotes for unknown concerts', async () => {
    concertRepository.findOne.mockResolvedValue(null);

    await expect(
      service.upvote('missing-concert', owner),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(concertUpvoteRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('only accepts new upvotes for active concerts', async () => {
    concertRepository.findOne.mockResolvedValue(null);

    await expect(
      service.upvote('hidden-concert', owner),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(concertRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'hidden-concert',
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      },
    });
  });

  describe('findAvailableGenres', () => {
    it('returns active controlled genre options in catalog order', async () => {
      genreRepository.find.mockResolvedValue([
        { slug: 'jazz', name: 'Jazz' },
        { slug: 'bluegrass', name: 'Bluegrass' },
        { slug: 'funk', name: 'Funk' },
        { slug: 'jam', name: 'Jam' },
        { slug: 'reggae', name: 'Reggae' },
        { slug: 'hip-hop', name: 'Hip-Hop' },
        { slug: 'rock', name: 'Rock' },
        { slug: 'folk', name: 'Folk' },
        { slug: 'salsa', name: 'Salsa' },
        { slug: 'electronic', name: 'Electronic' },
      ]);

      const result = await service.findAvailableGenres();

      expect(result).toEqual([
        { slug: 'jazz', name: 'Jazz' },
        { slug: 'bluegrass', name: 'Bluegrass' },
        { slug: 'funk', name: 'Funk' },
        { slug: 'jam', name: 'Jam' },
        { slug: 'reggae', name: 'Reggae' },
        { slug: 'hip-hop', name: 'Hip-Hop' },
        { slug: 'rock', name: 'Rock' },
        { slug: 'folk', name: 'Folk' },
        { slug: 'salsa', name: 'Salsa' },
        { slug: 'electronic', name: 'Electronic' },
      ]);
      expect(genreRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: {
          sortOrder: 'ASC',
          name: 'ASC',
        },
      });
      expect(concertRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(configService.get).not.toHaveBeenCalledWith(
        'CONCERT_GENRE_OPTIONS',
      );
    });

    it('returns an empty array when no active controlled genres are available', async () => {
      genreRepository.find.mockResolvedValue([]);

      const result = await service.findAvailableGenres();

      expect(result).toEqual([]);
    });
  });
});
