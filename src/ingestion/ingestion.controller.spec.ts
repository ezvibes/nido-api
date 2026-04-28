import { IngestionController } from './ingestion.controller';

describe('IngestionController', () => {
  const ingestionService = {
    uploadImage: jest.fn(),
    createJob: jest.fn(),
    getJob: jest.fn(),
  };

  let controller: IngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IngestionController(ingestionService as any);
  });

  it('should pass the simplified dto through on upload', async () => {
    const file = { originalname: 'flyer.jpg' } as Express.Multer.File;
    ingestionService.uploadImage.mockResolvedValue({ ok: true });

    await controller.uploadImage(
      file,
      { city: 'raleigh', source: 'flyer_upload' },
      { uid: 'uid-1' } as any,
    );

    expect(ingestionService.uploadImage).toHaveBeenCalledWith(
      file,
      { city: 'raleigh', source: 'flyer_upload' },
      'uid-1',
    );
  });

  it('should request a job for the current user', async () => {
    ingestionService.createJob.mockResolvedValue({ id: 'job-1' });

    await controller.createJob(
      { sourceAssetId: 'asset-1' },
      { uid: 'uid-1' } as any,
    );

    expect(ingestionService.createJob).toHaveBeenCalledWith(
      { sourceAssetId: 'asset-1' },
      'uid-1',
    );
  });

  it('should request a job lookup for the current user', async () => {
    ingestionService.getJob.mockResolvedValue({ id: 'job-1' });

    await controller.getJob('job-1', { uid: 'uid-1' } as any);

    expect(ingestionService.getJob).toHaveBeenCalledWith('job-1', 'uid-1');
  });
});
