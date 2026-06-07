import { AdminIngestionController } from './admin-ingestion.controller';

describe('AdminIngestionController', () => {
  const ingestionService = {
    adminListConcertUploads: jest.fn(),
    adminReviewConcertUpload: jest.fn(),
    adminStreamUploadImage: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
  };

  let controller: AdminIngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminIngestionController(
      ingestionService as any,
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
});
