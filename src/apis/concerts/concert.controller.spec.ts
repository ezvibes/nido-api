import type { DecodedIdToken } from 'firebase-admin/auth';
import { ConcertController } from './concert.controller';
import { ConcertService } from './concert.service';
import { UserService } from '../users/user.service';
import { ListConcertsDto } from './dto/list-concerts.dto';

describe('ConcertController', () => {
  const concertService = {
    findAllForOwner: jest.fn(),
    createForOwner: jest.fn(),
    upvote: jest.fn(),
    removeUpvote: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
  };

  let controller: ConcertController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConcertController(
      concertService as unknown as ConcertService,
      userService as unknown as UserService,
    );
  });

  it('lists concerts for the synced user with query options', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    const query = { sort: 'trending_week' } as ListConcertsDto;
    userService.syncFromToken.mockResolvedValue(owner);
    concertService.findAllForOwner.mockResolvedValue({ data: [] });

    await controller.listConcerts(decodedToken, query);

    expect(userService.syncFromToken).toHaveBeenCalledWith(decodedToken);
    expect(concertService.findAllForOwner).toHaveBeenCalledWith(owner, query);
  });

  it('creates a concert for the synced user', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    const dto = {
      title: 'Show',
      genre: 'Rock',
      startsAt: '2026-06-01T00:00:00.000Z',
      venues: [{ name: 'Venue' }],
      artists: [{ name: 'Artist' }],
    };
    userService.syncFromToken.mockResolvedValue(owner);
    concertService.createForOwner.mockResolvedValue({ id: 'concert-1' });

    await controller.createConcert(decodedToken, dto);

    expect(concertService.createForOwner).toHaveBeenCalledWith(owner, dto);
  });

  it('upvotes a concert for the synced user', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    userService.syncFromToken.mockResolvedValue(owner);
    concertService.upvote.mockResolvedValue({ concertId: 'concert-1' });

    await controller.upvoteConcert(decodedToken, 'concert-1');

    expect(concertService.upvote).toHaveBeenCalledWith('concert-1', owner);
  });

  it('removes an upvote for the synced user', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    userService.syncFromToken.mockResolvedValue(owner);
    concertService.removeUpvote.mockResolvedValue({ concertId: 'concert-1' });

    await controller.removeConcertUpvote(decodedToken, 'concert-1');

    expect(concertService.removeUpvote).toHaveBeenCalledWith(
      'concert-1',
      owner,
    );
  });
});
