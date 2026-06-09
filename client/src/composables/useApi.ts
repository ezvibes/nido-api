// src/composables/useApi.ts
import axios from 'axios';
import type { ConcertApiResponse } from '../types/events';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

/**
 * Sends the user's Firebase ID token to the backend API to sync the user.
 * @param {string} token The Firebase ID token.
 */
export async function syncUserToBackend(token: string) {
  try {
    const response = await apiClient.post('/users/sync', null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing user to backend:', error);
    // Handle specific errors if needed
    throw error;
  }
}

export async function updateUserProfile(
  token: string,
  payload: { name?: string; picture?: string },
) {
  try {
    const response = await apiClient.patch('/users/profile', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function fetchUserConcerts(
  token: string,
  params?: {
    sort?: 'soonest' | 'featured' | 'trending_week';
    startsAfter?: string;
    pageSize?: number;
  },
): Promise<ConcertApiResponse> {
  try {
    const response = await apiClient.get<ConcertApiResponse>('/concerts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user concerts:', error);
    throw error;
  }
}

export interface CreateConcertPayload {
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string;
  venues: Array<{
    name: string;
    city?: string;
    state?: string;
    country?: string;
  }>;
  artists: Array<{
    name: string;
    role?: string;
    genre?: string;
  }>;
  description?: string;
}

export async function createConcert(
  token: string,
  payload: CreateConcertPayload,
) {
  try {
    const response = await apiClient.post('/concerts', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating concert:', error);
    throw error;
  }
}

export interface ConcertEngagementResponse {
  concertId: string;
  upvoteCount: number;
  upvotedByMe: boolean;
  trendingWeekUpvotes: number;
}

export async function upvoteConcert(token: string, concertId: string) {
  try {
    const response = await apiClient.post<ConcertEngagementResponse>(
      `/concerts/${concertId}/upvote`,
      null,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error upvoting concert:', error);
    throw error;
  }
}

export async function removeConcertUpvote(token: string, concertId: string) {
  try {
    const response = await apiClient.delete<ConcertEngagementResponse>(
      `/concerts/${concertId}/upvote`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error removing concert upvote:', error);
    throw error;
  }
}

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
  source: string;
  uploadedByUserId?: number;
  uploadedAt: string;
}

export interface IngestionJobResponse {
  id: string;
  status: string;
  stage?: string;
  ocrProvider?: string;
  ocrConfidence?: number | null;
  parserVersion?: string;
  parseConfidence?: number | null;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  concertUpload: {
    id: string;
    storageUri: string;
    objectName: string;
    bucket: string;
    mimeType: string;
    originalFilename: string;
    city?: string;
    state?: string;
    source: string;
    size: number;
    uploadedByUid: string;
    uploadedByUserId?: number;
    createdAt: string;
  };
}

export async function createIngestionJob(
  token: string,
  concertUploadId: string,
) {
  try {
    const response = await apiClient.post<IngestionJobResponse>(
      '/ingestion/jobs',
      { concertUploadId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error creating ingestion job:', error);
    throw error;
  }
}

export async function uploadIngestionImage(
  token: string,
  payload: {
    file: File;
    city?: string;
    state?: string;
    source?: string;
  },
) {
  try {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.city) {
      formData.append('city', payload.city);
    }
    if (payload.state) {
      formData.append('state', payload.state);
    }
    if (payload.source) {
      formData.append('source', payload.source);
    }

    const response = await apiClient.post<IngestionUploadResult>(
      '/ingestion/uploads',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error uploading ingestion image:', error);
    throw error;
  }
}

export async function fetchIngestionJob(token: string, jobId: string) {
  try {
    const response = await apiClient.get<IngestionJobResponse>(
      `/ingestion/jobs/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching ingestion job:', error);
    throw error;
  }
}

export type ConcertSyncJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CreateConcertSyncJobPayload {
  calendarId?: string;
  fromDate?: string;
  toDate?: string;
  refreshTopPicks?: boolean;
  dryRun?: boolean;
  maxEvents?: number;
  geminiPrompt?: string;
  geminiContext?: string;
  sampleEvents?: Array<Record<string, unknown>>;
}

export interface ConcertSyncRecentEvent {
  calendarEventId: string;
  concertId?: string | null;
  extractionConfidence?: number | null;
  needsGuidance: boolean;
  extractionWarnings: string[];
  updatedAt: string;
}

export interface ConcertSyncJobResponse {
  id: string;
  status: ConcertSyncJobStatus;
  calendarId: string;
  calendarTimezone?: string | null;
  requestedRangeStart?: string | null;
  requestedRangeEnd?: string | null;
  refreshTopPicks: boolean;
  totalEventsFetched: number;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConcertSyncJobDetailResponse extends ConcertSyncJobResponse {
  recentEvents: ConcertSyncRecentEvent[];
}

export interface ConcertSyncJobListResponse {
  total: number;
  items: ConcertSyncJobResponse[];
}

export async function createConcertSyncJob(
  token: string,
  payload: CreateConcertSyncJobPayload,
) {
  const response = await apiClient.post<ConcertSyncJobResponse>(
    '/concert-sync/jobs',
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

export async function fetchConcertSyncJobs(
  token: string,
  params?: {
    status?: ConcertSyncJobStatus;
    limit?: number;
    offset?: number;
  },
) {
  const response = await apiClient.get<ConcertSyncJobListResponse>(
    '/concert-sync/jobs',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params,
    },
  );
  return response.data;
}

export async function fetchConcertSyncJob(token: string, jobId: string) {
  const response = await apiClient.get<ConcertSyncJobDetailResponse>(
    `/concert-sync/jobs/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

export type UploadReviewStatus = 'submitted' | 'approved' | 'rejected' | 'past';

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
}

export interface AdminConcertUploadListResponse {
  total: number;
  items: AdminConcertUploadListItem[];
}

export async function fetchAdminIngestionUploads(
  token: string,
  params?: {
    limit?: number;
    offset?: number;
    reviewStatus?: UploadReviewStatus;
  },
) {
  const response = await apiClient.get<AdminConcertUploadListResponse>(
    '/admin/ingestion/uploads',
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return response.data;
}

export async function reviewAdminIngestionUpload(
  token: string,
  uploadId: string,
  payload: { status: UploadReviewStatus; notes?: string },
) {
  const response = await apiClient.put<AdminConcertUploadListItem>(
    `/admin/ingestion/uploads/${uploadId}/review`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function fetchAdminIngestionUploadImageBlob(
  token: string,
  uploadId: string,
) {
  const response = await apiClient.get<Blob>(
    `/admin/ingestion/uploads/${uploadId}/image`,
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    },
  );
  return response.data;
}
