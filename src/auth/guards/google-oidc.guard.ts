import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { Request } from 'express';

@Injectable()
export class GoogleOidcGuard implements CanActivate {
  private readonly logger = new Logger(GoogleOidcGuard.name);
  private readonly oauth2Client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.oauth2Client = new OAuth2Client();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid Authorization header');
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Token missing');
    }

    const expectedAudience = this.configService.get<string>('INGESTION_WORKER_URL');
    const expectedServiceAccount = this.configService.get<string>('CLOUD_TASKS_INVOKER_SA');

    if (!expectedAudience || !expectedServiceAccount) {
      this.logger.error('OIDC Guard misconfigured: Missing INGESTION_WORKER_URL or CLOUD_TASKS_INVOKER_SA');
      throw new ForbiddenException('Guard misconfigured');
    }

    let payload;
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: token,
        audience: expectedAudience,
      });

      payload = ticket.getPayload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OIDC Token verification failed: ${msg}`);
      throw new UnauthorizedException('Invalid or expired OIDC token');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.email !== expectedServiceAccount) {
      this.logger.warn(`Unauthorized service account. Expected: ${expectedServiceAccount}, Got: ${payload.email}`);
      throw new ForbiddenException('Unauthorized service account');
    }

    if (!payload.email_verified) {
       this.logger.warn(`Email not verified for service account: ${payload.email}`);
       throw new ForbiddenException('Email not verified');
    }

    return true;
  }
}
