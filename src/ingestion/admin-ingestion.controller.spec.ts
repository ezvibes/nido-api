import { AdminIngestionController } from './admin-ingestion.controller';

describe('AdminIngestionController', () => {
  const ingestionService = {
    adminListConcertUploads: jest.fn(),
    adminReviewConcertUpload: jest.fn(),
    adminStreamUploadImage: jest.fn(),
  };
  const ingestionPublicationService = {
    listCandidates: jest.fn(),
    getCandidate: jest.fn(),
    publishCandidate: jest.fn(),
    handleDuplicateDecision: jest.fn(),
    rejectCandidate: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
  };

  let controller: AdminIngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminIngestionController(
      ingestionService as any,
      ingestionPublicationService as any,
      userService as any,
    );
  });

  it('should list uploads with parsed pagination and status filter', async () => {
    ingestionService.adminListConcertUploads.mockResolvedValue({
      total: 0,
      items: [],
    });

    const result = await controller.listUploads('10', '20', 'submitted');

    expect(ingestionService.adminListConcertUploads).toHaveBeenCalledWith({
      limit: 10,
      offset: 20,
      reviewStatus: 'submitted',
    });
    expect(result).toEqual({ total: 0, items: [] });
  });

  it('should save an upload review with the current admin profile id', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 7 });
    ingestionService.adminReviewConcertUpload.mockResolvedValue({
      id: 'upload-1',
      reviewStatus: 'approved',
    });

    const result = await controller.reviewUpload(
      'upload-1',
      { status: 'approved', notes: 'valid flyer' },
      { uid: 'admin-uid' } as any,
    );

    expect(userService.syncFromToken).toHaveBeenCalledWith({
      uid: 'admin-uid',
    });
    expect(ingestionService.adminReviewConcertUpload).toHaveBeenCalledWith(
      'upload-1',
      { status: 'approved', notes: 'valid flyer' },
      7,
    );
    expect(result).toEqual({ id: 'upload-1', reviewStatus: 'approved' });
  });

  it('should stream an upload image for preview', async () => {
    const res = {} as any;

    await controller.streamUploadImage('upload-1', res);

    expect(ingestionService.adminStreamUploadImage).toHaveBeenCalledWith(
      'upload-1',
      res,
    );
  });

  it('should list candidates with parsed pagination and status', async () => {
    ingestionPublicationService.listCandidates.mockResolvedValue({
      total: 1,
      items: [{ id: 'cand-1' }],
    });

    const result = await controller.listCandidates('pending', '10', '0');

    expect(ingestionPublicationService.listCandidates).toHaveBeenCalledWith({
      status: 'pending',
      limit: 10,
      offset: 0,
    });
    expect(result.total).toBe(1);
  });

  it('should get candidate details and probable duplicates', async () => {
    ingestionPublicationService.getCandidate.mockResolvedValue({
      candidate: { id: 'cand-1' },
      probableDuplicates: [],
    });

    const result = await controller.getCandidate('cand-1');

    expect(ingestionPublicationService.getCandidate).toHaveBeenCalledWith('cand-1');
    expect(result.candidate.id).toBe('cand-1');
  });

  it('should publish a candidate using reviewer profile id', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 42 });
    ingestionPublicationService.publishCandidate.mockResolvedValue({
      publishedConcertId: 'concert-100',
    });

    const body = {
      title: 'Doctor S',
      date: '2026-11-07',
      time: '20:00',
      bandIds: ['band-1'],
      genreIds: ['genre-1'],
      reviewDurationMs: 14000,
    };

    const result = await controller.publishCandidate('cand-1', body as any, { uid: 'admin-user' } as any);

    expect(userService.syncFromToken).toHaveBeenCalledWith({ uid: 'admin-user' });
    expect(ingestionPublicationService.publishCandidate).toHaveBeenCalledWith('cand-1', body, 42);
    expect(result.publishedConcertId).toBe('concert-100');
  });

  it('should handle duplicate decision with reviewer profile id', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 42 });
    ingestionPublicationService.handleDuplicateDecision.mockResolvedValue({
      publishedConcertId: 'concert-existing',
      status: 'published',
    });

    const body = {
      decision: 'link' as const,
      targetConcertId: 'concert-existing',
      reviewDurationMs: 12000,
    };

    const result = await controller.handleDuplicateDecision('cand-1', body as any, { uid: 'admin-user' } as any);

    expect(ingestionPublicationService.handleDuplicateDecision).toHaveBeenCalledWith('cand-1', body, 42);
    expect(result.status).toBe('published');
  });

  it('should reject a candidate with reviewer profile id', async () => {
    userService.syncFromToken.mockResolvedValue({ id: 42 });
    ingestionPublicationService.rejectCandidate.mockResolvedValue({
      status: 'rejected',
    });

    const result = await controller.rejectCandidate('cand-1', { reason: 'not a concert' }, { uid: 'admin-user' } as any);

    expect(ingestionPublicationService.rejectCandidate).toHaveBeenCalledWith('cand-1', 'not a concert', 42);
    expect(result.status).toBe('rejected');
  });
});
