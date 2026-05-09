import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';

const DEFAULT_ADMIN_EMAILS = ['ezvibesinc@gmail.com'];

@Injectable()
export class AdminEmailGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as DecodedIdToken | undefined;
    const email = user?.email?.trim().toLowerCase();

    if (!email) {
      throw new ForbiddenException('Admin access requires an email.');
    }

    const configured = this.configService.get<string>('ADMIN_EMAILS');
    const allowedEmails = new Set(
      (configured?.trim()
        ? configured.split(',').map((value) => value.trim().toLowerCase())
        : DEFAULT_ADMIN_EMAILS
      ).filter(Boolean),
    );

    if (!allowedEmails.has(email)) {
      throw new ForbiddenException('Admin access denied.');
    }

    return true;
  }
}

