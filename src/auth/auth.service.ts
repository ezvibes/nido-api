import { BadRequestException, Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    return this.firebaseService.authenticate(token);
  }

  getUserProfileFromToken(decodedToken: DecodedIdToken): {
    uid: string;
    email: string;
    picture?: string;
  } {
    const { uid, email, picture } = decodedToken;

    if (!email) {
      throw new BadRequestException(
        'Email not found in Firebase token. An email is required to create or sync a user.',
      );
    }

    return { uid, email, picture };
  }
}
