import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { App } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: App;

  private resolvePrivateKey() {
    const directPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (directPrivateKey) {
      return directPrivateKey.replace(/\\n/g, '\n');
    }

    const legacyPrivateKey = process.env.FIREBASE_PRIVATE_KEY_ID;
    if (legacyPrivateKey?.includes('BEGIN PRIVATE KEY')) {
      return legacyPrivateKey.replace(/\\n/g, '\n');
    }

    return undefined;
  }

  onModuleInit() {
    // To connect to your Firebase project, you need a Service Account.
    // 1. Go to your Firebase project console > Project Settings > Service accounts.
    // 2. Click "Generate new private key" and save the JSON file securely.
    // 3. Set the following environment variables in a .env file:
    //    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
    //
    // For security, it's best to load these from a config service (e.g., @nestjs/config).
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key can be tricky with .env files due to line breaks.
      // A common practice is to replace '\n' with '\\n' in the env value.
      privateKey: this.resolvePrivateKey(),
    };

    if (
      !serviceAccount.projectId ||
      !serviceAccount.clientEmail ||
      !serviceAccount.privateKey
    ) {
      console.warn(
        'Firebase Service Account credentials are not set. Firebase integration will be disabled.',
      );
      return;
    }

    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  get auth(): Auth {
    if (!this.firebaseApp) {
      throw new Error('Firebase app not initialized.');
    }
    return getAuth(this.firebaseApp);
  }

  /**
   * Verifies a Firebase JWT token.
   * This is the "bootstrap" method you mentioned. It takes the token from the
   * client, verifies it with Firebase, and returns the decoded user data.
   *
   * @param token The Firebase JWT from the client's Authorization header.
   * @returns The decoded token containing user information like UID and email.
   */
  public async authenticate(token: string) {
    if (!this.firebaseApp) {
      // If Firebase isn't initialized, we can't validate tokens.
      // Depending on the desired behavior, you could throw an error
      // or return a mock/guest user. Here, we'll throw an error.
      throw new Error('Firebase app not initialized. Cannot authenticate user.');
    }
    return this.auth.verifyIdToken(token);
  }
}
