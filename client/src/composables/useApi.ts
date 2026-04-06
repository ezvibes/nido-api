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
