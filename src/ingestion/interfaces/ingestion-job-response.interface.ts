export interface IngestionJobResponse {
  id: string;
  status: string;
  stage?: string;
  ocrProvider?: string;
  ocrConfidence?: number | null;
  parserVersion?: string;
  parseConfidence?: number | null;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  concertUpload: {
    id: string;
    storageUri: string;
    objectName: string;
    bucket: string;
    mimeType: string;
    originalFilename: string;
    city?: string;
    state?: string;
    genre?: string;
    concertDate?: string;
    venueId?: string;
    bandId?: string;
    source: string;
    size: number;
    uploadedByUid: string;
    uploadedByUserId?: number;
    createdAt: Date;
    reviewStatus?: string;
    concertId?: string | null;
  };
  candidates?: Array<{
    id: string;
    candidateIndex: number;
    status: string;
    publishedConcertId?: string | null;
    title?: string;
    date?: string;
    time?: string;
    venueName?: string;
    bandNames?: string[];
    warnings?: string[];
  }>;
}
