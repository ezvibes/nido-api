// src/composables/useApi.ts
import axios from 'axios';

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
  payload: { name?: string; picture?: string }
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

export async function fetchUserConcerts(token: string) {
  try {
    const response = await apiClient.get('/concerts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

export async function createConcert(token: string, payload: CreateConcertPayload) {
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

export async function createIngestionJob(token: string, concertUploadId: string) {
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
    const response = await apiClient.get<IngestionJobResponse>(`/ingestion/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching ingestion job:', error);
    throw error;
  }
}
