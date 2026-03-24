export interface IngestionUploadResult {
  bucket: string;
  objectName: string;
  storageUri: string;
  contentType: string;
  size: number;
  originalFilename: string;
  citySlug?: string;
  regionSlug?: string;
  sourceType: string;
  uploadedAt: string;
}
