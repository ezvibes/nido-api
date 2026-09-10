import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AdminEmailGuard } from './admin-email.guard';

@Injectable()
export class SchedulerOrAdminGuard implements CanActivate {
  private readonly adminEmailGuard: AdminEmailGuard;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.adminEmailGuard = new AdminEmailGuard(configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Check for Cloud Scheduler Secret in request headers
    const schedulerSecretHeader =
      request.headers['x-scheduler-secret'] ||
      request.headers['X-Scheduler-Secret'] ||
      request.headers['x-internal-secret'];

    const configuredSecret = this.configService
      .get<string>('INTERNAL_SCHEDULER_SECRET')
      ?.trim();

    if (configuredSecret && schedulerSecretHeader === configuredSecret) {
      request.isSchedulerRun = true;
      return true;
    }

    // 2. Fall back to Firebase Bearer token verification & Admin Email check
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException(
        'Authorization header or X-Scheduler-Secret is required.',
      );
    }

    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token is missing.');
    }

    try {
      const decodedToken = await this.authService.verifyIdToken(token);
      request.user = decodedToken;

      const isAdmin = this.adminEmailGuard.canActivate(context);
      if (!isAdmin) {
        throw new ForbiddenException('Admin access denied for this email.');
      }

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException(`Invalid or expired token: ${error?.message || error}`);
    }
  }
}
