import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from './users/entities/user.entity';
import { SecurityService } from './security/security.service';
import { v4 as uuidv4 } from 'uuid';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import {
  MFASetupResponse,
  MFALoginResponse,
  GenerateRecoveryCodesResponse,
  AuthResponse,
} from './auth/auth.interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private securityService: SecurityService,
  ) {}

  /**
   * Validates a user based on username and password.
   * @param username The user's username.
   * @param pass The user's plaintext password.
   * @returns The user object without the password hash if validation succeeds, otherwise null.
   */
  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const user = await this.usersService.findOneByUsername(username);
      if (!user) {
        this.logger.warn(`Login attempt for non-existent user: ${username}`);
        return null;
      }

      const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      // Remove the password hash from the returned user object for security
      const { passwordHash, ...result } = user;
      this.logger.log(`User validated successfully: ${username}`);
      return result;
    } catch (error) {
      this.logger.error('Error during user validation:', error);
      return null;
    }
  }

  /**
   * Enhanced login method that checks for MFA requirement
   */
  async enhancedLogin(
    user: Omit<User, 'passwordHash'>,
    request?: any,
  ): Promise<MFALoginResponse> {
    try {
      // Check if user has MFA enabled
      if (user.mfaEnabled) {
        // Generate temporary token for MFA verification
        const tempTokenPayload = {
          sub: user.id,
          username: user.username,
          type: 'temp_mfa',
          tokenId: uuidv4(),
        };

        const tempToken = this.jwtService.sign(tempTokenPayload, {
          expiresIn: '10m', // 10 minutes to complete MFA
        });

        this.logger.log(`MFA required for user: ${user.username}`);
        return {
          requiresMFA: true,
          tempToken,
        };
      }

      // No MFA required, proceed with normal login
      const loginResult = await this.login(user, request);
      return {
        requiresMFA: false,
        ...loginResult,
      };
    } catch (error) {
      this.logger.error('Error during enhanced login:', error);
      throw new UnauthorizedException('Login failed');
    }
  }

  /**
   * Generates JWT access and refresh tokens for a user.
   * @param user The user object.
   * @param request Optional request object for IP and user agent.
   * @returns An object containing the access token, refresh token, and user info.
   */
  async login(
    user: Omit<User, 'passwordHash'>,
    request?: any,
  ): Promise<AuthResponse> {
    try {
      // Generate unique token IDs for tracking
      const accessTokenId = uuidv4();
      const refreshTokenId = uuidv4();

      // Calculate expiry dates
      const accessTokenExpiryMinutes = 10;
      const refreshTokenExpiryDays = 7;
      const accessTokenExpiresAt = new Date(
        Date.now() + accessTokenExpiryMinutes * 60 * 1000,
      );
      const refreshTokenExpiresAt = new Date(
        Date.now() + refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
      );

      // Short-lived access token (10 minutes)
      const accessTokenPayload = {
        username: user.username,
        sub: user.id,
        name: user.name,
        role: user.role,
        tokenId: accessTokenId, // JWT ID for blacklisting
        type: 'access',
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, {
        expiresIn: '10m',
      });

      // Long-lived refresh token (7 days)
      const refreshTokenPayload = {
        sub: user.id,
        tokenId: refreshTokenId,
        type: 'refresh',
      };

      const refreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn: '7d',
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });

      // Store refresh token session in PostgreSQL
      const ipAddress = request?.ip || request?.connection?.remoteAddress;
      const userAgent = request?.headers?.['user-agent'];

      await this.securityService.createSession(
        user.id,
        refreshToken,
        refreshTokenExpiresAt,
        ipAddress ? ipAddress : undefined,
        userAgent ? userAgent : undefined,
        refreshTokenId, // Pass the jti for efficient lookup
      );

      this.logger.log(`Login successful for user: ${user.username}`);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: accessTokenExpiryMinutes * 60, // 10 minutes in seconds
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error('Error during login token generation:', error);
      throw new UnauthorizedException('Failed to generate tokens');
    }
  }

  /**
   * Verifies MFA token and completes login
   */
  async verifyMFAAndLogin(
    tempToken: string,
    totpToken: string,
    request?: any,
  ): Promise<AuthResponse> {
    try {
      const decoded = this.jwtService.verify(tempToken);

      if (decoded.type !== 'temp_mfa') {
        throw new UnauthorizedException('Invalid temporary token');
      }

      const user = await this.usersService.findOneById(decoded.sub);

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not properly configured');
      }

      let verified = false;
      verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpToken,
        window: 2,
      });
      if (!verified) {
        verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: totpToken,
          window: 1,
        });
      }
      if (!verified) {
        verified = this.customTOTPVerify(totpToken, user.mfaSecret);
      }

      if (!verified) {
        this.logger.warn(`Failed MFA attempt for user: ${user.username}`);
        throw new UnauthorizedException('Invalid MFA token');
      }

      this.logger.log(`MFA verification successful for user: ${user.username}`);

      const { passwordHash, ...userWithoutPassword } = user;
      return this.login(userWithoutPassword, request);
    } catch (error) {
      this.logger.error('Error during MFA verification:', error);
      throw new UnauthorizedException('MFA verification failed');
    }
  }

  /**
   * Verifies recovery code and completes login
   */
  async verifyRecoveryCodeAndLogin(
    tempToken: string,
    recoveryCode: string,
    request?: any,
  ): Promise<AuthResponse> {
    try {
      const decoded = this.jwtService.verify(tempToken);

      if (decoded.type !== 'temp_mfa') {
        throw new UnauthorizedException('Invalid temporary token');
      }

      const user = await this.usersService.findOneById(decoded.sub);

      if (!user || !user.mfaEnabled || !user.mfaRecoveryCodes) {
        throw new UnauthorizedException('Recovery codes not available');
      }

      const hashedCode = this.hashRecoveryCode(recoveryCode);

      const codeIndex = user.mfaRecoveryCodes.indexOf(hashedCode);

      if (codeIndex === -1) {
        this.logger.warn(
          `Invalid recovery code attempt for user: ${user.username}`,
        );
        throw new UnauthorizedException('Invalid recovery code');
      }

      const updatedCodes = [...user.mfaRecoveryCodes];
      updatedCodes.splice(codeIndex, 1);

      await this.usersService.updateUser(user.id, {
        mfaRecoveryCodes: updatedCodes,
      });

      this.logger.log(
        `Recovery code used successfully for user: ${user.username}`,
      );

      const { passwordHash, ...userWithoutPassword } = user;
      return this.login(userWithoutPassword, request);
    } catch (error) {
      this.logger.error('Error during recovery code verification:', error);
      throw new UnauthorizedException('Recovery code verification failed');
    }
  }

  /**
   * Generates TOTP secret and QR code for MFA setup
   */
  async generateMFASetup(userId: string): Promise<MFASetupResponse> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.mfaEnabled) {
        throw new UnauthorizedException('MFA is already enabled');
      }

      this.logger.debug(
        `Starting MFA setup for user ${userId} (${user.username})`,
      );

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Voting System (${user.username})`,
        issuer: 'Voting System',
        length: 32,
      });

      this.logger.debug(`Generated MFA secret material for user ${userId}`);

      // Store the secret temporarily (not enabled yet)
      await this.usersService.updateUser(userId, {
        mfaEnabled: false, // Ensure flag is off
        mfaSecret: secret.base32,
      });

      this.logger.debug(`Saved MFA secret for user ${userId} to database`);

      // Verify it was saved by reading it back
      const updatedUser = await this.usersService.findOneById(userId);
      if (!updatedUser.mfaSecret) {
        throw new UnauthorizedException('Failed to persist MFA setup secret');
      }
      this.logger.debug(`Verified MFA secret persistence for user ${userId}`);

      // Generate QR code
      const otpauthUrl = secret.otpauth_url || '';
      const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

      this.logger.log(`MFA setup completed for user: ${user.username}`);

      return {
        qrCodeUrl,
        setupKey: secret.base32 || '',
      };
    } catch (error) {
      this.logger.error('Error during MFA setup generation:', error);
      throw new UnauthorizedException('Failed to generate MFA setup');
    }
  }

  /**
   * Enables MFA after verifying initial TOTP token
   */
  async enableMFA(
    userId: string,
    totpToken: string,
  ): Promise<GenerateRecoveryCodesResponse> {
    try {
      const user = await this.usersService.findOneById(userId);

      if (!user || !user.mfaSecret) {
        throw new UnauthorizedException('MFA setup not found');
      }

      let verified = false;
      verified = (speakeasy.totp.verify as any)({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpToken,
        window: 2,
      });
      if (!verified) {
        verified = (speakeasy.totp.verify as any)({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: totpToken,
          window: 1,
        });
      }
      if (!verified) {
        verified = this.customTOTPVerify(totpToken, user.mfaSecret);
      }

      if (!verified) {
        this.logger.warn(`Invalid TOTP token for user ${userId}`);
        throw new UnauthorizedException('Invalid TOTP token');
      }

      const recoveryCodes = this.generateRecoveryCodes();
      const hashedCodes = recoveryCodes.map((code) =>
        this.hashRecoveryCode(code),
      );

      await this.usersService.updateUser(userId, {
        mfaEnabled: true,
        mfaRecoveryCodes: hashedCodes,
      });

      this.logger.log(`MFA enabled successfully for user: ${user.username}`);

      return {
        recoveryCodes,
      };
    } catch (error) {
      this.logger.error('Error during MFA enablement:', error);
      throw error;
    }
  }

  /**
   * Custom TOTP verification implementation for debugging
   */
  private customTOTPVerify(token: string, secret: string): boolean {
    try {
      const now = Math.floor(Date.now() / 1000);
      const currentCounter = Math.floor(now / 30);

      for (let i = -2; i <= 2; i++) {
        const candidateTime = (currentCounter + i) * 30;
        const expectedToken = speakeasy.totp({
          secret: secret,
          encoding: 'base32',
          time: candidateTime,
          step: 30,
        });

        if (expectedToken === token) {
          this.logger.debug(`MFA token validated with window offset ${i}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Custom MFA verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Disables MFA for a user
   */
  async disableMFA(
    userId: string,
    totpToken: string,
  ): Promise<{ success: boolean }> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not enabled');
      }

      // Verify the TOTP token
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpToken,
        window: 1,
      });

      if (!verified) {
        throw new UnauthorizedException('Invalid TOTP token');
      }

      // Disable MFA
      await this.usersService.updateUser(userId, {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
      });

      this.logger.log(`MFA disabled for user: ${user.username}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Error during MFA disabling:', error);
      throw new UnauthorizedException('Failed to disable MFA');
    }
  }

  /**
   * Regenerates recovery codes
   */
  async regenerateRecoveryCodes(
    userId: string,
    totpToken: string,
  ): Promise<GenerateRecoveryCodesResponse> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not enabled');
      }

      // Verify the TOTP token
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpToken,
        window: 1,
      });

      if (!verified) {
        throw new UnauthorizedException('Invalid TOTP token');
      }

      // Generate new recovery codes
      const recoveryCodes = this.generateRecoveryCodes();
      const hashedCodes = recoveryCodes.map((code) =>
        this.hashRecoveryCode(code),
      );

      // Update recovery codes
      await this.usersService.updateUser(userId, {
        mfaRecoveryCodes: hashedCodes,
      });

      this.logger.log(`Recovery codes regenerated for user: ${user.username}`);

      return {
        recoveryCodes,
      };
    } catch (error) {
      this.logger.error('Error during recovery codes regeneration:', error);
      throw new UnauthorizedException('Failed to regenerate recovery codes');
    }
  }

  /**
   * Generates recovery codes
   */
  private generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Hashes a recovery code
   */
  private hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * @param refreshToken The refresh token.
   * @returns New access and refresh tokens.
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      // Verify the refresh token
      const decoded = this.jwtService.verify(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });

      // Verify this is a refresh token
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if session exists and is valid
      const session = await this.securityService.findValidSession(refreshToken);
      if (!session) {
        throw new UnauthorizedException('Refresh token not found or expired');
      }

      // Get user info for token
      const user = await this.usersService.findOneById(session.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const newAccessTokenId = uuidv4();
      const newRefreshTokenId = uuidv4();

      const accessTokenExpiryMinutes = 10;
      const refreshTokenExpiryDays = 7;
      const newRefreshTokenExpiresAt = new Date(
        Date.now() + refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
      );

      // New access token (10 minutes)
      const accessTokenPayload = {
        username: user.username,
        sub: user.id,
        name: user.name,
        role: user.role,
        tokenId: newAccessTokenId,
        type: 'access',
      };

      const newAccessToken = this.jwtService.sign(accessTokenPayload, {
        expiresIn: '10m',
      });

      // New refresh token (7 days)
      const refreshTokenPayload = {
        sub: user.id,
        tokenId: newRefreshTokenId,
        type: 'refresh',
      };

      const newRefreshToken = this.jwtService.sign(refreshTokenPayload, {
        expiresIn: '7d',
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });

      // Revoke old session and create new one
      await this.securityService.revokeSession(session.id);
      await this.securityService.createSession(
        user.id,
        newRefreshToken,
        newRefreshTokenExpiresAt,
        session.ipAddress || undefined,
        session.userAgent || undefined,
        newRefreshTokenId, // Pass the jti for efficient lookup
      );

      // Revoke old refresh token
      await this.securityService.revokeToken(
        decoded.tokenId,
        user.id,
        new Date(decoded.exp * 1000),
      );

      this.logger.log(`Token refreshed for user: ${user.username}`);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: accessTokenExpiryMinutes * 60, // 10 minutes in seconds
      };
    } catch (error) {
      this.logger.error('Error during token refresh:', error);
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  /**
   * Logs out a user by revoking their refresh tokens and blacklisting current token.
   * @param user The user context from the JWT.
   * @param accessToken The raw access token to extract expiration time.
   * @returns Success status.
   */
  async logout(user: any, accessToken?: string): Promise<{ message: string }> {
    try {
      // Revoke current access token
      if (user.tokenId) {
        let expiresAt: Date;

        // If we have the raw token, decode it to get the exact expiration
        if (accessToken) {
          try {
            const decoded = this.jwtService.decode(accessToken);
            expiresAt = new Date(decoded.exp * 1000);
          } catch (decodeError) {
            this.logger.warn(
              'Failed to decode access token for logout, using fallback expiration',
            );
            // Fallback: assume 10 minutes from now (default access token expiry)
            expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          }
        } else if (user.exp) {
          expiresAt = new Date(user.exp * 1000);
        } else {
          // Fallback: assume 10 minutes from now (default access token expiry)
          expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        }

        await this.securityService.revokeToken(
          user.tokenId,
          user.id || user.sub,
          expiresAt,
          'access',
        );
      }

      // Revoke all user sessions
      await this.securityService.revokeAllUserSessions(user.id || user.sub);

      this.logger.log(
        `Logout successful for user: ${user.username || user.sub}`,
      );

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Error during logout:', error);
      throw new UnauthorizedException('Failed to logout');
    }
  }

  /**
   * Validates a JWT token and returns the user context.
   * @param token The JWT token to validate.
   * @returns The user context if valid, null otherwise.
   */
  async validateToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token);

      // Check if token is revoked
      if (decoded.tokenId) {
        const isRevoked = await this.securityService.isTokenRevoked(
          decoded.tokenId,
        );
        if (isRevoked) {
          this.logger.warn('Attempted to use revoked token');
          return null;
        }
      }

      return decoded;
    } catch (error) {
      this.logger.warn('Invalid token provided');
      return null;
    }
  }

  /**
   * Revokes all sessions for a user (for password changes, security incidents).
   * @param userId The user ID.
   * @param reason The reason for revocation.
   * @returns Success status.
   */
  async revokeAllSessions(
    userId: string,
    reason: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.securityService.revokeAllUserSessions(userId);
      this.logger.log(`All sessions revoked for user ${userId}: ${reason}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Error revoking all sessions:', error);
      return { success: false };
    }
  }

  /**
   * Gets the complete user profile including MFA status
   * @param userId The user ID
   * @returns User profile with MFA information
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Return user profile without sensitive information
      const { passwordHash, mfaSecret, mfaRecoveryCodes, ...profile } = user;
      return {
        ...profile,
        // Include MFA status but not sensitive MFA data
        mfaEnabled: user.mfaEnabled,
        hasRecoveryCodes:
          user.mfaRecoveryCodes && user.mfaRecoveryCodes.length > 0,
        recoveryCodesCount: user.mfaRecoveryCodes
          ? user.mfaRecoveryCodes.length
          : 0,
      };
    } catch (error) {
      this.logger.error('Error fetching user profile:', error);
      throw new UnauthorizedException('Failed to fetch user profile');
    }
  }

  /**
   * Verifies the current password for security operations
   * @param userId The user ID
   * @param currentPassword The current password to verify
   */
  async verifyCurrentPassword(
    userId: string,
    currentPassword: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        this.logger.warn(
          `Invalid current password verification for user: ${user.username}`,
        );
        throw new UnauthorizedException('Invalid current password');
      }

      this.logger.log(`Current password verified for user: ${user.username}`);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error during current password verification:', error);
      throw new UnauthorizedException('Password verification failed');
    }
  }

  /**
   * Changes the user's password
   * @param userId The user ID
   * @param currentPassword The current password
   * @param newPassword The new password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        this.logger.warn(
          `Invalid current password for password change: ${user.username}`,
        );
        throw new UnauthorizedException('Invalid current password');
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        throw new UnauthorizedException(
          'New password must be at least 8 characters long',
        );
      }

      if (newPassword === currentPassword) {
        throw new UnauthorizedException(
          'New password must be different from current password',
        );
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password in database
      await this.usersService.updatePassword(userId, newPasswordHash);

      // Revoke all sessions except current one (user will need to log in again on other devices)
      await this.securityService.revokeAllUserSessions(userId);

      this.logger.log(
        `Password changed successfully for user: ${user.username}`,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error during password change:', error);
      throw new UnauthorizedException('Password change failed');
    }
  }

  /**
   * Simple MFA verification for security operations (doesn't return tokens)
   * @param userId The user ID
   * @param token The TOTP token
   */
  async verifyMFASimple(userId: string, token: string): Promise<void> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not configured');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      if (!isValid) {
        this.logger.warn(`Invalid MFA token for user: ${user.username}`);
        throw new UnauthorizedException('Invalid authentication code');
      }

      this.logger.log(`MFA verification successful for user: ${user.username}`);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error during MFA verification:', error);
      throw new UnauthorizedException('MFA verification failed');
    }
  }

  /**
   * Simple recovery code verification for security operations (doesn't return tokens)
   * @param userId The user ID
   * @param recoveryCode The recovery code
   */
  async verifyRecoveryCodeSimple(
    userId: string,
    recoveryCode: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findOneById(userId);
      if (!user || !user.mfaEnabled || !user.mfaRecoveryCodes) {
        throw new UnauthorizedException('MFA not configured');
      }

      const hashedCode = this.hashRecoveryCode(recoveryCode);
      const codeIndex = user.mfaRecoveryCodes.indexOf(hashedCode);

      if (codeIndex === -1) {
        this.logger.warn(`Invalid recovery code for user: ${user.username}`);
        throw new UnauthorizedException('Invalid recovery code');
      }

      // Remove the used recovery code
      user.mfaRecoveryCodes.splice(codeIndex, 1);
      await this.usersService.updateUser(user.id, {
        mfaRecoveryCodes: user.mfaRecoveryCodes,
      });

      this.logger.log(
        `Recovery code verification successful for user: ${user.username}`,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error during recovery code verification:', error);
      throw new UnauthorizedException('Recovery code verification failed');
    }
  }
}
