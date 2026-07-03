import type { UploadReviewStatus } from '../entities/concert-upload.entity';

export interface AdminConcertUploadListItem {
  id: string;
  storageUri: string;
  bucket: string;
  objectName: string;
  mimeType: string;
  originalFilename: string;
  size: number;
  city?: string;
  state?: string;
  source: string;
  uploadedByUid: string;
  uploadedByUserId?: number;
  uploadedByUserEmail?: string;
  createdAt: string;
  reviewStatus: UploadReviewStatus;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedByUserId?: number;
  reviewedByUserEmail?: string;
  concertId?: string;
}

export interface AdminConcertUploadListResponse {
  total: number;
  items: AdminConcertUploadListItem[];
}
