export interface IngestionUploadResult {
  sourceAssetId: string;
  ingestionJobId: string;
  status: string;
  bucket: string;
  objectName: string;
  storageUri: string;
  contentType: string;
  size: number;
  originalFilename: string;
  city?: string;
  source: string;
  uploadedAt: string;
}
