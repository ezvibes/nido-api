export interface UploadableFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
