import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserContext, Role } from '../auth.interfaces';
import { SecurityService } from '../../security/security.service';
// import { UsersService } from '../../users/users.service'; // If fetching fresh user data

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private securityService: SecurityService,
    // private usersService: UsersService, // Uncomment if needed
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => {
          // Also extract from cookies for HTTP-only cookie support
          return request.cookies?.session;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the JWT payload and returns the user context.
   * @param payload The JWT payload containing user information.
   * @returns The user context object for use in request handlers.
   */
  async validate(payload: JwtPayload): Promise<UserContext> {
    // Validate that the payload contains required fields
    if (!payload.sub || !payload.username) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Validate that the role is a valid Role enum value
    const userRole = payload.role;
    if (
      !userRole ||
      (typeof userRole === 'string' &&
        !Object.values(Role).includes(userRole as Role))
    ) {
      throw new UnauthorizedException('Invalid user role');
    }

    // Check if the access token has been revoked
    if (payload.tokenId) {
      const isRevoked = await this.securityService.isTokenRevoked(
        payload.tokenId,
      );
      if (isRevoked) {
        throw new UnauthorizedException('Access token has been revoked');
      }
    }

    // Construct and return the user context
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.name || undefined,
      role: userRole as Role, // Convert string to Role enum
      roles: [userRole as Role], // Create roles array with the primary role
      tokenId: payload.tokenId,
      sessionId: payload.sessionId || undefined,
    };
  }
}
