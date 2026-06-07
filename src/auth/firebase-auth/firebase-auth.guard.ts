import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (this.isDevBypassEnabled()) {
      request.user = this.buildDevUser(request.headers);
      return true;
    }

    const { authorization } = request.headers;

    if (!authorization) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token is missing.');
    }

    try {
      const decodedToken = await this.authService.verifyIdToken(token);
      // Attach the decoded token to the request object for use in controllers
      request.user = decodedToken;
      return true;
    } catch (error) {
      console.error('Firebase auth guard failed:', error);
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private isDevBypassEnabled() {
    const bypass = this.configService.get<string>('AUTH_DEV_BYPASS');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    return bypass?.trim().toLowerCase() === 'true' && nodeEnv !== 'production';
  }

  private buildDevUser(headers: Record<string, string | string[] | undefined>) {
    const defaultEmail =
      this.configService.get<string>('ADMIN_EMAILS')?.split(',')[0]?.trim() ||
      'dev@example.local';
    const uid = this.getHeader(headers, 'x-dev-user-uid') || 'dev-user';
    const email = this.getHeader(headers, 'x-dev-user-email') || defaultEmail;
    const name = this.getHeader(headers, 'x-dev-user-name') || 'Dev User';

    return {
      aud: this.configService.get<string>('FIREBASE_PROJECT_ID') || 'local-dev',
      auth_time: Math.floor(Date.now() / 1000),
      email,
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      firebase: {
        identities: { email: [email] },
        sign_in_provider: 'custom',
      },
      iat: Math.floor(Date.now() / 1000),
      iss: 'local-dev',
      name,
      picture: this.getHeader(headers, 'x-dev-user-picture'),
      sub: uid,
      uid,
    } as DecodedIdToken;
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
