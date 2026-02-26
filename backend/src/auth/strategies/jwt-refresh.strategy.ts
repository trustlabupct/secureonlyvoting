import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserContext, Role } from '../auth.interfaces';
import { SecurityService } from '../../security/security.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private securityService: SecurityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => {
          // Extract refresh token from cookies
          return request.cookies?.refresh_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the refresh token payload and returns the user context.
   * @param payload The JWT payload containing refresh token information.
   * @returns The user context object for use in request handlers.
   */
  async validate(payload: JwtPayload): Promise<UserContext> {
    // Validate that this is a refresh token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Validate that the payload contains required fields
    if (!payload.sub || !payload.tokenId) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    // Check if the refresh token has been revoked
    if (payload.tokenId) {
      const isRevoked = await this.securityService.isTokenRevoked(
        payload.tokenId,
      );
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    }

    // Return minimal user context for refresh operations
    // The actual session validation will be done in the AuthService.refreshToken method
    return {
      id: payload.sub,
      username: payload.username || '',
      role: payload.role as Role,
      roles: payload.role ? [payload.role as Role] : [],
      tokenId: payload.tokenId,
    };
  }
}
