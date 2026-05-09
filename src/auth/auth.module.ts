import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from './firebase-auth/firebase-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminEmailGuard } from './guards/admin-email.guard';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController],
  providers: [FirebaseAuthGuard, AdminEmailGuard, AuthService],
  exports: [FirebaseAuthGuard, AdminEmailGuard, AuthService],
})
export class AuthModule {}
