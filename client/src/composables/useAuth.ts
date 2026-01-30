// src/composables/useAuth.ts
import { ref } from 'vue';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User
} from 'firebase/auth';
import { googleProvider } from '../firebase';
import { syncUserToBackend } from './useApi';
import router from '../router';

// A reactive object to hold the user's state
const user = ref<User | null>(null);
const auth = getAuth();

// A flag to prevent duplicate sync calls
let isSyncing = false;

/**
 * A reactive composable to manage user authentication state and actions.
 */
export function useAuth() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser;
    
    if (firebaseUser && !isSyncing) {
      isSyncing = true;
      try {
        console.log('Auth state changed, syncing user...');
        const token = await firebaseUser.getIdToken();
        await syncUserToBackend(token);
      } catch (error) {
        console.error('Failed to sync user on auth change:', error);
      } finally {
        isSyncing = false;
      }
      
      // After login, redirect to home if not already there
      if (router.currentRoute.value.path !== '/') {
        router.push('/');
      }
    }
  });

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Error signing up with email:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Error signing in with email:", error);
      alert(`Error: ${error.message}`);
    }
  };
  
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // Redirect to home page after sign out
      router.push('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return {
    user,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
  };
}
