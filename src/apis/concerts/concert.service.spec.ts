import { NotFoundException } from '@nestjs/common';
import { ConcertService } from './concert.service';
import { Concert } from './entities/concert.entity';
import { ConcertUpvote } from './entities/concert-upvote.entity';
import { User } from '../users/entities/user.entity';

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
  ].forEach((method) => {
    qb[method] = jest.fn().mockReturnValue(qb);
  });
  qb.clone = jest.fn().mockReturnValue(qb);
  qb.getCount = jest.fn();
  qb.getRawAndEntities = jest.fn();
  qb.getRawOne = jest.fn();
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
    },
  };
  const concertUpvoteRepository = {
    createQueryBuilder: jest.fn(),
  };

  let service: ConcertService;
  const owner = { id: 3 } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConcertService(
      concertRepository as any,
      concertUpvoteRepository as any,
    );
  });

  it('returns concerts with engagement counts and trending ordering', async () => {
    const qb = createQueryBuilderMock();
    const concert = {
      id: 'concert-1',
      title: 'Show',
      genre: 'Rock',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
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
        venues: [
          { name: 'The Pour House', city: 'Raleigh', state: 'NC' },
        ],
        artists: [
          { name: 'Example Band', role: 'headliner', genre: 'Indie Rock' },
        ],
      }),
    );
    expect(result.data[0]).not.toHaveProperty('venue');
    expect(result.data[0]).not.toHaveProperty('lineup');
  });

  it('uses a null user parameter for anonymous shared-feed requests', async () => {
    const qb = createQueryBuilderMock();
    concertRepository.createQueryBuilder.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(0);
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.findAll({ sort: 'soonest', page: 1, pageSize: 20 });

    expect(qb.setParameter).toHaveBeenCalledWith('currentUserId', null);
    expect(qb.addSelect).toHaveBeenCalledTimes(8);
    expect(qb.groupBy).not.toHaveBeenCalled();
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
    expect(result.upvotedByMe).toBe(false);
  });

  it('rejects upvotes for unknown concerts', async () => {
    concertRepository.findOne.mockResolvedValue(null);

    await expect(
      service.upvote('missing-concert', owner),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(concertUpvoteRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
