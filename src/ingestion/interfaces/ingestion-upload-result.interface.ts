export interface IngestionUploadResult {
  concertUploadId: string;
  bucket: string;
  objectName: string;
  storageUri: string;
  contentType: string;
  size: number;
  originalFilename: string;
  city?: string;
  state?: string;
  genre?: string;
  source: string;
  uploadedByUserId?: number;
  uploadedAt: string;
}
