import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserContext } from '../auth.interfaces'; // Assuming UserContext is the type of 'user' if auth succeeds

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  // Override handleRequest to not throw an error if JWT authentication fails.
  // It allows the route to proceed, and request.user will be populated if auth succeeds.
  handleRequest<TUser = UserContext>(
    err: any,
    user: TUser | false | null, // passport-jwt can return false for failure, or null based on strategy
    info: any, // Can be Error instance (e.g., TokenExpiredError, JsonWebTokenError) or string message
    context: ExecutionContext,
    status?: any,
  ): TUser | undefined {
    if (err) {
      this.logger.warn(`Optional auth error: ${err.message || err}`);
      return undefined; // Error during authentication, treat as unauthenticated
    }

    if (info && info instanceof Error) {
      this.logger.log(
        `Optional auth info (token issue likely): ${info.message}`,
      );
      // Example: JsonWebTokenError: jwt malformed, TokenExpiredError: jwt expired
      return undefined; // Token was present but invalid, treat as unauthenticated
    }

    // If user is populated (meaning token was valid and JwtStrategy.validate returned a user)
    if (user) {
      return user as TUser;
    }

    // If no user, no error, and no specific info error, it means no token was likely provided, or strategy returned null/false intentionally.
    // This is the "optional" part - proceed without an authenticated user.
    this.logger.log(
      'No user authenticated via JWT (optional auth), proceeding without user context.',
    );
    return undefined;
  }
}
