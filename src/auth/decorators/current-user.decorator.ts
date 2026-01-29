import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * A custom parameter decorator to extract the user object from the request.
 * The user object is attached to the request by the FirebaseAuthGuard.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: DecodedIdToken) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
