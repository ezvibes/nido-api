import { IngestionController } from './ingestion.controller';
import { UploadableFile } from './interfaces/uploadable-file.interface';

describe('IngestionController', () => {
  const ingestionService = {
    uploadImage: jest.fn(),
  };
  const userService = {
    syncFromToken: jest.fn(),
  };

  let controller: IngestionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IngestionController(
      ingestionService as any,
      userService as any,
    );
  });

  it('should pass the simplified dto through on upload', async () => {
    const file = { originalname: 'flyer.jpg' } as UploadableFile;
    ingestionService.uploadImage.mockResolvedValue({ ok: true });
    userService.syncFromToken.mockResolvedValue({ id: 3 });

    await controller.uploadImage(
      { file: [file] },
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
});
