import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  ConcertController,
  SitemapController,
} from './concert.controller';
import { ConcertService } from './concert.service';
import { UserService } from '../users/user.service';
import { ListConcertsDto } from './dto/list-concerts.dto';

describe('ConcertController', () => {
  const concertService = {
    findAll: jest.fn(),
    findAllForOwner: jest.fn(),
    findOneForViewer: jest.fn(),
    generatePublicSitemapXml: jest.fn(),
    generatePublicSitemapIndexXml: jest.fn(),
    createForOwner: jest.fn(),
    upvote: jest.fn(),
    removeUpvote: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
    findExistingFromToken: jest.fn(),
  };

  let controller: ConcertController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConcertController(
      concertService as unknown as ConcertService,
      userService as unknown as UserService,
    );
  });

  it('lists concerts publicly without creating or syncing a user', async () => {
    const query = { sort: 'soonest' } as ListConcertsDto;
    concertService.findAll.mockResolvedValue({ data: [] });

    await controller.listConcerts(undefined, query);

    expect(userService.findExistingFromToken).not.toHaveBeenCalled();
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findAll).toHaveBeenCalledWith(query, undefined);
  });

  it('adds existing-user engagement to the shared feed without syncing', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const currentUser = { id: 3 };
    const query = { sort: 'trending_week' } as ListConcertsDto;
    userService.findExistingFromToken.mockResolvedValue(currentUser);
    concertService.findAll.mockResolvedValue({ data: [] });

    await controller.listConcerts(decodedToken, query);

    expect(userService.findExistingFromToken).toHaveBeenCalledWith(
      decodedToken,
    );
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findAll).toHaveBeenCalledWith(query, currentUser);
  });

  it('lists concerts owned by the synced user with query options', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    const query = { sort: 'soonest' } as ListConcertsDto;
    userService.syncFromToken.mockResolvedValue(owner);
    concertService.findAllForOwner.mockResolvedValue({ data: [] });

    await controller.listMyConcerts(decodedToken, query);

    expect(concertService.findAllForOwner).toHaveBeenCalledWith(owner, query);
  });

  it('creates a concert for the synced user', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const owner = { id: 3 };
    const dto = {
      title: 'Show',
      genre: 'Rock',
      startsAt: '2026-06-01T00:00:00.000Z',
      venueId: 'venue-uuid',
      bandIds: ['band-uuid'],
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

  it('gets a single concert publicly without syncing a user', async () => {
    concertService.findOneForViewer.mockResolvedValue({ id: 'concert-1' });

    const result = await controller.getConcert(undefined, 'concert-1');

    expect(userService.findExistingFromToken).not.toHaveBeenCalled();
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findOneForViewer).toHaveBeenCalledWith(
      'concert-1',
      undefined,
    );
    expect(result).toEqual({ id: 'concert-1' });
  });

  it('gets a single concert with existing user context when authenticated', async () => {
    const decodedToken = { uid: 'uid-1' } as DecodedIdToken;
    const currentUser = { id: 3 };
    userService.findExistingFromToken.mockResolvedValue(currentUser);
    concertService.findOneForViewer.mockResolvedValue({
      id: 'concert-1',
      upvotedByMe: true,
    });

    const result = await controller.getConcert(decodedToken, 'concert-1');

    expect(userService.findExistingFromToken).toHaveBeenCalledWith(
      decodedToken,
    );
    expect(userService.syncFromToken).not.toHaveBeenCalled();
    expect(concertService.findOneForViewer).toHaveBeenCalledWith(
      'concert-1',
      currentUser,
    );
    expect(result).toEqual({ id: 'concert-1', upvotedByMe: true });
  });

  it('returns public sitemap XML and sitemap index XML with optional page query on both /concerts/sitemap*.xml and /sitemap*.xml', async () => {
    concertService.generatePublicSitemapXml.mockResolvedValue('<urlset />');
    concertService.generatePublicSitemapIndexXml.mockResolvedValue(
      '<sitemapindex />',
    );
    const sitemapController = new SitemapController(
      concertService as unknown as ConcertService,
    );

    const xml = await controller.getPublicSitemap('2');
    const rootXml = await sitemapController.getRootSitemap();
    const indexXml = await controller.getPublicSitemapIndex();
    const rootIndexXml = await sitemapController.getRootSitemapIndex();

    expect(concertService.generatePublicSitemapXml).toHaveBeenNthCalledWith(
      1,
      undefined,
      { page: 2 },
    );
    expect(concertService.generatePublicSitemapXml).toHaveBeenNthCalledWith(
      2,
      undefined,
      { page: 1 },
    );
    expect(concertService.generatePublicSitemapIndexXml).toHaveBeenCalledTimes(
      2,
    );
    expect(xml).toBe('<urlset />');
    expect(rootXml).toBe('<urlset />');
    expect(indexXml).toBe('<sitemapindex />');
    expect(rootIndexXml).toBe('<sitemapindex />');
  });
});
