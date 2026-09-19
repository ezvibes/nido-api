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
  concertDate?: string;
  venueId?: string;
  bandId?: string;
  source: string;
  uploadedByUserId?: number;
  uploadedAt: string;
}
