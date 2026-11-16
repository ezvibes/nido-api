// src/composables/useAuth.ts
import { computed, ref } from 'vue';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { googleProvider, storage } from '../firebase';
import {
  syncUserToBackend,
  updateUserOnboarding,
  updateUserProfile as updateUserProfileApi,
  type BackendUserProfile,
} from './useApi';
import router from '../router';

export const PARTNER_INVITE_STORAGE_KEY = 'nido_partner_invite_code';

export function captureInviteCodeFromUrl(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): string | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('invite')?.trim().toUpperCase();
    if (raw && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(PARTNER_INVITE_STORAGE_KEY, raw);
      return raw;
    }
  } catch {
    // Ignore sessionStorage or URL parsing errors
  }
  return null;
}

captureInviteCodeFromUrl();

// A reactive object to hold the user's state
const auth = getAuth();
const user = ref<User | null>(auth.currentUser);
const backendUser = ref<BackendUserProfile | null>(null);
const needsOnboarding = computed(() =>
  Boolean(
    user.value && backendUser.value && !backendUser.value.onboardingCompletedAt,
  ),
);

const syncCurrentBackendUser = async (firebaseUser: User | null) => {
  if (!firebaseUser) {
    backendUser.value = null;
    return null;
  }

  try {
    const token = await firebaseUser.getIdToken();
    if (!token || token === 'mock-dev-token') {
      return null;
    }
    const synced = await syncUserToBackend(token);
    backendUser.value = synced;
    return synced;
  } catch (error) {
    console.warn('Unable to sync user profile with backend:', error);
    return null;
  }
};

onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser;
  void syncCurrentBackendUser(firebaseUser);
});

/**
 * A reactive composable to manage user authentication state and actions.
 */
export function useAuth() {
  const devLogin = () => {
    user.value = {
      uid: 'dev-admin-uid',
      email: 'admin@example.com',
      displayName: 'Dev Admin',
      getIdToken: async () => 'mock-dev-token',
    } as any;
    router.push('/concerts');
  };

  const signInWithGoogle = async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await syncCurrentBackendUser(credential.user ?? auth.currentUser);
      await router.push('/concerts');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          'Firebase Google Auth unavailable locally; falling back to Dev Login mode.',
        );
        devLogin();
        return;
      }
      console.error('Error signing in with Google:', error);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await syncCurrentBackendUser(credential.user ?? auth.currentUser);
      await router.push('/concerts');
    } catch (error: any) {
      if (import.meta.env.DEV) {
        devLogin();
        return;
      }
      console.error('Error signing up with email:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await syncCurrentBackendUser(credential.user ?? auth.currentUser);
      await router.push('/concerts');
    } catch (error: any) {
      if (import.meta.env.DEV) {
        devLogin();
        return;
      }
      console.error('Error signing in with email:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      backendUser.value = null;
      // Redirect to home page after sign out
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
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

        await syncUserToBackend(token);
        await updateUserProfileApi(token, apiPayload);
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

  const updateProfilePicture = async (file: File): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('You must be logged in to update your profile picture.');
      return null;
    }

    const fileRef = storageRef(
      storage,
      `profilePictures/${currentUser.uid}/${file.name}`,
    );

    try {
      const snapshot = await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);

      await updateUserProfile({ photoURL });

      // Refresh user state
      user.value = auth.currentUser;
      return photoURL;
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile picture.');
    }
    return null;
  };

  const getIdToken = async (
    forceRefresh?: boolean,
  ): Promise<string | undefined> => {
    if (auth.currentUser) {
      return auth.currentUser.getIdToken(forceRefresh);
    }
    if (user.value && typeof (user.value as any).getIdToken === 'function') {
      return (user.value as any).getIdToken(forceRefresh);
    }
    return undefined;
  };

  const completeOnboarding = async (payload: {
    inviteCode?: string | null;
    claimedVenueId?: string | null;
    skipAsFan?: boolean;
  }): Promise<BackendUserProfile> => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('You must be signed in to complete onboarding.');
    }
    const updated = await updateUserOnboarding(token, payload);
    backendUser.value = updated;
    return updated;
  };

  const refreshBackendUser = async () => {
    return syncCurrentBackendUser(auth.currentUser ?? user.value);
  };

  return {
    user,
    backendUser,
    needsOnboarding,
    getIdToken,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    updateUserProfile,
    updateProfilePicture,
    completeOnboarding,
    refreshBackendUser,
    captureInviteCodeFromUrl,
    devLogin,
  };
}
