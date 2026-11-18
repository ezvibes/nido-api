// src/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const measurementId =
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined;

// Load credentials from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoKeyForLocalDev1234567890',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-nido.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-nido',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-nido.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:demo1234567890',
  ...(measurementId ? { measurementId } : {}),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Services
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Lazily initializes Firebase Analytics only in supported browser environments when measurementId is configured.
 */
async function getAnalyticsClient(): Promise<Analytics | null> {
  if (!measurementId || typeof window === 'undefined') {
    return null;
  }
  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

export { auth, storage, googleProvider, getAnalyticsClient };
