import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from './firebase-auth/firebase-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController],
  providers: [FirebaseAuthGuard, AuthService],
  exports: [FirebaseAuthGuard, AuthService],
})
export class AuthModule {}
