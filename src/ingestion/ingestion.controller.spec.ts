import { IngestionController } from './ingestion.controller';
import { UploadableFile } from './interfaces/uploadable-file.interface';

describe('IngestionController', () => {
  const ingestionService = {
    uploadImage: jest.fn(),
    createJob: jest.fn(),
    getConcertUpload: jest.fn(),
    getJob: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
  };

  let controller: IngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IngestionController(ingestionService as any, userService as any);
  });

  it('should pass the simplified dto through on upload', async () => {
    const file = { originalname: 'flyer.jpg' } as UploadableFile;
    ingestionService.uploadImage.mockResolvedValue({ ok: true });
    userService.syncFromToken.mockResolvedValue({ id: 3 });

    await controller.uploadImage(
      file,
      { city: 'raleigh', state: 'NC', source: 'flyer_upload' },
      { uid: 'uid-1' } as any,
    );

    expect(userService.syncFromToken).toHaveBeenCalledWith({ uid: 'uid-1' });
    expect(ingestionService.uploadImage).toHaveBeenCalledWith(
      file,
      { city: 'raleigh', state: 'NC', source: 'flyer_upload' },
      'uid-1',
      3,
    );
  });

  it('should request a job for the current user', async () => {
    ingestionService.createJob.mockResolvedValue({ id: 'job-1' });

    await controller.createJob({ concertUploadId: 'asset-1' }, { uid: 'uid-1' } as any);

    expect(ingestionService.createJob).toHaveBeenCalledWith('asset-1', 'uid-1');
  });

  it('should fetch a job for the current user', async () => {
    ingestionService.getJob.mockResolvedValue({ id: 'job-1' });

    await controller.getJob('job-1', { uid: 'uid-1' } as any);

    expect(ingestionService.getJob).toHaveBeenCalledWith('job-1', 'uid-1');
  });

  it('should fetch an upload for the current user', async () => {
    ingestionService.getConcertUpload.mockResolvedValue({ concertUploadId: 'asset-1' });

    await controller.getUpload('asset-1', { uid: 'uid-1' } as any);

    expect(ingestionService.getConcertUpload).toHaveBeenCalledWith('asset-1', 'uid-1');
  });
});
