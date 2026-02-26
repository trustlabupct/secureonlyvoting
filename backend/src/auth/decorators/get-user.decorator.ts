import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserContext, RequestWithUser } from '../auth.interfaces';

/**
 * Custom decorator to extract the user object, or a specific property of the user object,
 * from the request. Assumes an authentication guard has already populated `request.user`.
 *
 * @example
 * // Get the entire user object
 * @GetUser() user: UserContext
 *
 * @example
 * // Get a specific property (e.g., 'id') from the user object
 * @GetUser('id') userId: string
 */
export const GetUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      // This should not happen if an AuthGuard is in place.
      // Throw an error to fail fast if the user object is unexpectedly missing.
      throw new InternalServerErrorException(
        'User not found in request. Ensure AuthGuard is active.',
      );
    }

    if (data) {
      return user[data];
    }
    return user;
  },
);

/**
 * Optional variant of GetUser.
 * Returns undefined when no authenticated user exists on request.
 */
export const GetOptionalUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
