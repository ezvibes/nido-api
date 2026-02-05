import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;

    if (!authorization) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    const token = authorization.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Bearer token is missing.');
    }

    try {
      const decodedToken = await this.authService.verifyIdToken(token);
      // Attach the decoded token to the request object for use in controllers
      request.user = decodedToken;
      return true;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
