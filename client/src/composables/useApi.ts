// src/composables/useApi.ts
import axios from 'axios';
import type { ConcertApiItem, ConcertApiResponse } from '../types/concerts';

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

export async function fetchConcerts(
  token?: string,
  params?: {
    sort?: 'soonest' | 'featured' | 'trending_week';
    startsAfter?: string;
    pageSize?: number;
  },
): Promise<ConcertApiResponse> {
  try {
    const response = await apiClient.get<ConcertApiResponse>('/concerts', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user concerts:', error);
    throw error;
  }
}

export interface ConcertGenresResponse {
  genres: string[];
  options?: Array<{
    slug: string;
    name: string;
  }>;
}

export async function fetchConcertGenres(): Promise<ConcertGenresResponse> {
  const response = await apiClient.get<ConcertGenresResponse>(
    '/concerts/meta/genres',
  );
  return response.data;
}

export type AdminConcertCatalogStatus = 'active' | 'hidden' | 'archived';

export interface UpdateAdminConcertPayload {
  expectedVersion: number;
  title?: string;
  genre?: string;
  startsAt?: string;
  endsAt?: string | null;
  venueId?: string | null;
  description?: string | null;
  catalogStatus?: AdminConcertCatalogStatus;
  isFeatured?: boolean;
  resumeSyncUpdates?: boolean;
}

export async function fetchAdminConcerts(
  token: string,
  params?: {
    q?: string;
    catalogStatus?: AdminConcertCatalogStatus | 'all';
    isFeatured?: boolean;
    startsAfter?: string;
    startsBefore?: string;
    sort?:
      | 'soonest'
      | 'latest'
      | 'recently_added'
      | 'featured'
      | 'top_picks'
      | 'trending_week';
    page?: number;
    pageSize?: number;
  },
): Promise<ConcertApiResponse> {
  const response = await apiClient.get<ConcertApiResponse>('/admin/concerts', {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return response.data;
}

export async function updateAdminConcert(
  token: string,
  concertId: string,
  payload: UpdateAdminConcertPayload,
) {
  const response = await apiClient.patch<ConcertApiItem>(
    `/admin/concerts/${concertId}`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

export async function setConcertApproval(
  token: string,
  concertId: string,
  approved: boolean,
) {
  const response = await apiClient.put<ConcertApiItem>(
    `/admin/concerts/${concertId}/approval`,
    { approved },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

export interface CreateConcertPayload {
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  venueId: string;
  bandIds?: string[];
  lineup?: Array<{ bandId: string; role?: string; order?: number }>;
  description?: string | null;
}

export async function createConcert(
  token: string,
  payload: CreateConcertPayload,
) {
  const response = await apiClient.post<ConcertApiItem>(
    '/concerts',
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

export async function uploadConcertPoster(
  token: string,
  concertId: string,
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ uploadId: string; posterUrl: string }>(
    `/admin/concerts/${concertId}/poster`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data;
}

export interface BandListItem {
  id: string;
  name: string;
  slug: string;
  genres: string[];
}

export async function fetchBands(q?: string): Promise<BandListItem[]> {
  const response = await apiClient.get<BandListItem[]>('/bands', {
    params: q ? { q } : undefined,
  });
  return response.data;
}

export async function createBand(
  token: string,
  name: string,
): Promise<BandListItem> {
  const response = await apiClient.post<BandListItem>(
    '/bands',
    { name },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

export async function fetchUserConcerts(
  token: string,
  params?: {
    sort?: 'soonest' | 'recently_added' | 'featured' | 'trending_week';
    startsAfter?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ConcertApiResponse> {
  try {
    const response = await apiClient.get<ConcertApiResponse>('/concerts/mine', {
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
  genre?: string;
  concertDate?: string;
  venueId?: string;
  bandId?: string;
  source: string;
  uploadedByUserId?: number;
  uploadedAt: string;
}

export interface IngestionCandidateSummary {
  id: string;
  candidateIndex: number;
  status: 'pending' | 'published' | 'rejected' | string;
  publishedConcertId?: string | null;
  title?: string;
  date?: string;
  time?: string;
  venueName?: string;
  bandNames?: string[];
  warnings?: string[];
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
    genre?: string;
    source: string;
    size: number;
    uploadedByUid: string;
    uploadedByUserId?: number;
    reviewStatus?: string;
    concertId?: string | null;
    createdAt: string;
  };
  candidates?: IngestionCandidateSummary[];
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
    genre?: string;
    source?: string;
    concertDate?: string;
    venueId?: string;
    bandId?: string;
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
    const genre = payload.genre?.trim();
    if (genre) {
      formData.append('genre', genre);
    }
    if (payload.source) {
      formData.append('source', payload.source);
    }
    if (payload.concertDate) {
      formData.append('concertDate', payload.concertDate);
    }
    if (payload.venueId) {
      formData.append('venueId', payload.venueId);
    }
    if (payload.bandId) {
      formData.append('bandId', payload.bandId);
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

export async function fetchMyIngestionSubmissions(token: string) {
  try {
    const response = await apiClient.get<IngestionJobResponse[]>(
      '/ingestion/submissions',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching ingestion submissions:', error);
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
  concertTitle?: string | null;
  extractionConfidence?: number | null;
  needsGuidance: boolean;
  extractionWarnings: string[];
  updatedAt: string;
}

export interface ConcertSyncJobResponse {
  id: string;
  status: ConcertSyncJobStatus;
  performedByUserId?: number | null;
  performedByUserEmail?: string | null;
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
  genre?: string;
  concertDate?: string;
  venueId?: string;
  venueName?: string;
  bandId?: string;
  bandName?: string;
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
  payload: {
    status: UploadReviewStatus;
    notes?: string;
    concertTitle?: string;
    concertGenre?: string;
    concertStartsAt?: string;
    concertVenueName?: string;
    concertBandName?: string;
    concertDescription?: string;
  },
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

export interface AdminIngestionCandidateListItem {
  id: string;
  status: 'pending' | 'published' | 'rejected';
  candidateIndex: number;
  ingestionJobId: string;
  publishedConcertId?: string | null;
  provenance?: {
    title?: { rawValue: string; confidence?: number; warnings?: string[] };
    date?: { rawValue: string; confidence?: number; warnings?: string[] };
    time?: { rawValue: string; confidence?: number; warnings?: string[] };
    venue?: { rawValue: string; confidence?: number; warnings?: string[] };
    venueExtracted?: { rawValue: string; confidence?: number; warnings?: string[] };
    performerLineup?: { rawValue: string; normalizedValue?: string[]; confidence?: number; warnings?: string[] };
    bands?: { rawValue: string; confidence?: number }[];
    genres?: { rawValue: string; confidence?: number }[];
    ticketUrl?: { rawValue: string; confidence?: number };
    price?: { rawValue: string; confidence?: number };
    rawOcrText?: string;
    modelName?: string;
    reviewAudit?: any;
    [key: string]: any;
  };
  suggestedVenueId?: string | null;
  suggestedBandIds?: string[] | null;
  suggestedGenreIds?: string[] | null;
  createdAt: string;
  upload?: {
    id: string;
    originalFilename: string;
    city?: string;
    state?: string;
    uploadedByUid?: string;
    uploadedByUserEmail?: string;
    createdAt: string;
    posterUrl: string;
  } | null;
}

export interface AdminIngestionCandidateListResponse {
  total: number;
  items: AdminIngestionCandidateListItem[];
}

export interface AdminIngestionCandidateDetailResponse {
  candidate: AdminIngestionCandidateListItem;
  probableDuplicates: Array<{
    id: string;
    title: string;
    startsAt: string;
    venue?: { id: string; name: string; city: string; state: string };
    lineup?: Array<{ band?: { id: string; name: string } }>;
  }>;
  upload?: AdminIngestionCandidateListItem['upload'];
}

export interface PublishCandidatePayload {
  title: string;
  date: string;
  time: string;
  venueId?: string;
  venueName?: string;
  bandIds: string[];
  bandNames?: string[];
  genreIds: string[];
  genre?: string;
  notes?: string;
  reviewDurationMs: number;
}

export interface DuplicateDecisionPayload {
  decision: 'link' | 'merge' | 'publish_separately' | 'reject';
  targetConcertId?: string;
  publishData?: PublishCandidatePayload;
  reviewDurationMs: number;
  rejectReason?: string;
}

export async function fetchAdminIngestionCandidates(
  token: string,
  params?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AdminIngestionCandidateListResponse> {
  const response = await apiClient.get<AdminIngestionCandidateListResponse>(
    '/admin/ingestion/candidates',
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return response.data;
}

export async function fetchAdminIngestionCandidate(
  token: string,
  candidateId: string,
): Promise<AdminIngestionCandidateDetailResponse> {
  const response = await apiClient.get<AdminIngestionCandidateDetailResponse>(
    `/admin/ingestion/candidates/${candidateId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function publishAdminCandidate(
  token: string,
  candidateId: string,
  payload: PublishCandidatePayload,
): Promise<{ publishedConcertId: string }> {
  const response = await apiClient.post<{ publishedConcertId: string }>(
    `/admin/ingestion/candidates/${candidateId}/publish`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function submitAdminDuplicateDecision(
  token: string,
  candidateId: string,
  payload: DuplicateDecisionPayload,
): Promise<{ publishedConcertId?: string; status: string }> {
  const response = await apiClient.post<{ publishedConcertId?: string; status: string }>(
    `/admin/ingestion/candidates/${candidateId}/duplicate-decision`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function rejectAdminCandidate(
  token: string,
  candidateId: string,
  reason: string,
): Promise<{ status: string }> {
  const response = await apiClient.post<{ status: string }>(
    `/admin/ingestion/candidates/${candidateId}/reject`,
    { reason },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export interface VenueListItem {
  id: string;
  name: string;
  address?: string;
  city: string;
  citySlug: string;
  region: string;
  regionSlug: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchVenues(
  token?: string,
  params?: { citySlug?: string },
) {
  const response = await apiClient.get<VenueListItem[]>('/venues', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params,
  });
  return response.data;
}

export async function fetchVenue(token: string, id: string) {
  const response = await apiClient.get<VenueListItem>(`/venues/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function createVenue(
  token: string,
  payload: Partial<VenueListItem>,
) {
  const response = await apiClient.post<VenueListItem>('/venues', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function updateVenue(
  token: string,
  id: string,
  payload: Partial<VenueListItem>,
) {
  const response = await apiClient.put<VenueListItem>(
    `/venues/${id}`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export async function deleteVenue(token: string, id: string) {
  const response = await apiClient.delete<void>(`/venues/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export interface GenerateNewsletterPayload {
  startDate: string;
  endDate: string;
  editionType?: 'weekly' | 'monthly' | 'custom';
  dateRangeLabel?: string;
  weekendRecap?: string;
  featuredShow?: string;
  featuredFestival?: string;
  rawCalendarData?: string;
  useDatabase?: boolean;
  featuredOnly?: boolean;
  topPicksOnly?: boolean;
  excludeConcertIds?: string[];
}

export interface GenerateNewsletterResponse {
  newsletterDraft: string;
  concertsCount: number;
}

export interface NewsletterSourceConcert {
  id?: string;
  title: string;
  date: string;
  venue: string;
  artists?: string;
  genre?: string;
  description?: string;
  isTopPick: boolean;
  topPickScore: number;
  isHighlightArtist: boolean;
  isPartnerArtist: boolean;
  source: string;
}

export interface NewsletterSourcePreviewResponse {
  dateRangeLabel: string;
  concerts: NewsletterSourceConcert[];
  calendarEvents: NewsletterSourceConcert[];
  concertsCount: number;
  calendarEventsCount: number;
  totalCount: number;
}

export async function generateNewsletter(
  token: string,
  payload: GenerateNewsletterPayload,
): Promise<GenerateNewsletterResponse> {
  const response = await apiClient.post<GenerateNewsletterResponse>(
    '/api/newsletter/generate-weekly',
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

export async function previewNewsletterSources(
  token: string,
  payload: GenerateNewsletterPayload,
): Promise<NewsletterSourcePreviewResponse> {
  const response = await apiClient.post<NewsletterSourcePreviewResponse>(
    '/api/newsletter/preview-sources',
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}
