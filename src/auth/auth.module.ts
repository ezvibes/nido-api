import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from './firebase-auth/firebase-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminEmailGuard } from './guards/admin-email.guard';
import { OptionalFirebaseAuthGuard } from './firebase-auth/optional-firebase-auth.guard';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController],
  providers: [
    FirebaseAuthGuard,
    OptionalFirebaseAuthGuard,
    AdminEmailGuard,
    AuthService,
  ],
  exports: [
    FirebaseAuthGuard,
    OptionalFirebaseAuthGuard,
    AdminEmailGuard,
    AuthService,
  ],
})
export class AuthModule {}
