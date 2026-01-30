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
    const response = await apiClient.post('/auth/sync', null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('User synced successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error syncing user to backend:', error);
    // Handle specific errors if needed
    throw error;
  }
}
