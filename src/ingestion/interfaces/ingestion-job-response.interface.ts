export interface IngestionJobResponse {
  id: string;
  status: string;
  stage?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  sourceAsset: {
    id: string;
    storageUri: string;
    objectName: string;
    bucket: string;
    mimeType: string;
    originalFilename: string;
    city?: string;
    source: string;
    size: number;
    uploadedByUid: string;
    createdAt: Date;
  };
}
