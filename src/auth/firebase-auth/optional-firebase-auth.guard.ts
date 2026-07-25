import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Injectable()
export class OptionalFirebaseAuthGuard extends FirebaseAuthGuard {
  constructor(authService: AuthService, configService: ConfigService) {
    super(authService, configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const hasDevIdentityHeaders =
      request.headers['x-dev-user-uid'] || request.headers['x-dev-user-email'];

    if (!request.headers.authorization && !hasDevIdentityHeaders) {
      return true;
    }

    return super.canActivate(context);
  }
}
