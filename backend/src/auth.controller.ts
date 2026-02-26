import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // Use the appropriate guard
import { AuthService } from './auth.service';
import { LoginDto } from './users/entities/user.dto';
import {
  UseRateLimitPolicy,
  RateLimitGuard,
} from './security/guards/rate-limit.guard';
import {
  MFAVerifyRequest,
  MFAEnableRequest,
  MFALoginRequest,
  RecoveryCodeRequest,
} from './auth/auth.interfaces';

@Controller('auth')
@UseGuards(RateLimitGuard) // Apply rate limiting to all auth endpoints
@UseRateLimitPolicy() // Use policy-driven rate limiting for all endpoints
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Enhanced login that checks for MFA requirement
   * @param req The incoming request object, populated with the user by the AuthGuard.
   * @param loginDto The login credentials DTO for validation.
   * @returns Login response with MFA requirement check
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req, @Body() loginDto: LoginDto) {
    // The AuthGuard validates credentials and populates req.user
    return this.authService.enhancedLogin(req.user, req);
  }

  /**
   * Verifies MFA token and completes login
   */
  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify-login')
  async verifyMFALogin(@Body() mfaRequest: MFALoginRequest, @Request() req) {
    return this.authService.verifyMFAAndLogin(
      mfaRequest.tempToken,
      mfaRequest.token,
      req,
    );
  }

  /**
   * Verifies recovery code and completes login
   */
  @HttpCode(HttpStatus.OK)
  @Post('mfa/recovery-login')
  async recoveryCodeLogin(
    @Body() recoveryRequest: RecoveryCodeRequest,
    @Request() req,
  ) {
    return this.authService.verifyRecoveryCodeAndLogin(
      recoveryRequest.tempToken,
      recoveryRequest.recoveryCode,
      req,
    );
  }

  /**
   * Generate MFA setup (QR code and secret)
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/setup')
  async setupMFA(@Request() req) {
    return this.authService.generateMFASetup(req.user.id);
  }

  /**
   * Enable MFA after verifying TOTP token
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  async enableMFA(@Request() req, @Body() enableRequest: MFAEnableRequest) {
    return this.authService.enableMFA(req.user.id, enableRequest.token);
  }

  /**
   * Disable MFA
   */
  @UseGuards(AuthGuard('jwt'))
  @Delete('mfa')
  async disableMFA(@Request() req, @Body() verifyRequest: MFAVerifyRequest) {
    return this.authService.disableMFA(req.user.id, verifyRequest.token);
  }

  /**
   * Regenerate recovery codes
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/recovery-codes')
  async regenerateRecoveryCodes(
    @Request() req,
    @Body() verifyRequest: MFAVerifyRequest,
  ) {
    return this.authService.regenerateRecoveryCodes(
      req.user.id,
      verifyRequest.token,
    );
  }

  /**
   * Refresh token endpoint - policy-driven rate limiting (10 per minute)
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  async refresh(@Request() req) {
    // Extract the refresh token from the request
    const refreshToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.refresh_token;
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * Logout endpoint - policy-driven rate limiting (20 per minute)
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req) {
    // Extract the access token from the request to get the full JWT payload
    const accessToken =
      req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session;
    return this.authService.logout(req.user, accessToken);
  }

  /**
   * Get current user profile - policy-driven rate limiting (30 per minute)
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getUserProfile(req.user.id);
  }

  /**
   * Verify current password for security operations
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('verify-password')
  async verifyPassword(
    @Request() req,
    @Body() body: { currentPassword: string },
  ) {
    await this.authService.verifyCurrentPassword(
      req.user.id,
      body.currentPassword,
    );
    return { success: true };
  }

  /**
   * Change user password
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { success: true };
  }

  /**
   * Verify MFA for security operations (simplified)
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/verify')
  async verifyMFA(@Request() req, @Body() body: { token: string }) {
    await this.authService.verifyMFASimple(req.user.id, body.token);
    return { success: true };
  }

  /**
   * Verify recovery code for security operations (simplified)
   */
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/verify-recovery')
  async verifyRecovery(@Request() req, @Body() body: { recoveryCode: string }) {
    await this.authService.verifyRecoveryCodeSimple(
      req.user.id,
      body.recoveryCode,
    );
    return { success: true };
  }
}
