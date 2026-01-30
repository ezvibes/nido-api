// src/composables/useAuth.ts
import { ref } from 'vue';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type User
} from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, } from 'firebase/storage';
import { googleProvider, storage } from '../firebase';
import { syncUserToBackend, updateUserProfile } from './useApi';
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
        const token = await firebaseUser.getIdToken();
        await syncUserToBackend(token);
      } catch (error) {
        console.error('Failed to sync user on auth change:', error);
      } finally {
        isSyncing = false;
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

  const updateUserProfile = async (payload: {
    displayName?: string;
    photoURL?: string;
  }) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        await updateProfile(currentUser, payload);

        // Prepare the payload for your backend API
        const apiPayload: { name?: string; picture?: string } = {};
        if (payload.displayName) {
          apiPayload.name = payload.displayName;
        }
        if (payload.photoURL) {
          apiPayload.picture = payload.photoURL;
        }

        await updateUserProfile(token, apiPayload);
        // Optionally, force refresh the token to get updated claims
        await currentUser.getIdToken(true);
        user.value = auth.currentUser; // Refresh user state
        alert('Profile updated successfully!');
      } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile.');
      }
    }
  };

  const updateProfilePicture = async (file: File) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('You must be logged in to update your profile picture.');
      return;
    }

    const fileRef = storageRef(
      storage,
      `profilePictures/${currentUser.uid}/${file.name}`
    );

    try {
      const snapshot = await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);

      await updateUserProfile({ photoURL });

      // Refresh user state
      user.value = auth.currentUser;
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile picture.');
    }
  };

  return {
    user,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    updateUserProfile,
    updateProfilePicture,
  };
}
