import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users.service';
import { UserContext, Role } from '../auth.interfaces';
import * as crypto from 'crypto';

@Injectable()
export class CertificateStrategy extends PassportStrategy(
  Strategy,
  'certificate',
) {
  private readonly logger = new Logger(CertificateStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super();
  }

  async validate(req: any): Promise<UserContext> {
    try {
      // Extract client certificate from the request
      const clientCert =
        req.connection?.getPeerCertificate?.() ||
        req.socket?.getPeerCertificate?.();

      if (!clientCert || !clientCert.subject) {
        this.logger.warn('No client certificate provided');
        throw new UnauthorizedException('Client certificate required');
      }

      // Verify certificate is not expired
      const now = new Date();
      const notBefore = new Date(clientCert.valid_from);
      const notAfter = new Date(clientCert.valid_to);

      if (now < notBefore || now > notAfter) {
        this.logger.warn('Client certificate is expired or not yet valid');
        throw new UnauthorizedException('Certificate expired or not yet valid');
      }

      // Verify certificate chain (basic validation)
      if (!this.verifyCertificateChain(clientCert)) {
        this.logger.warn('Certificate chain validation failed');
        throw new UnauthorizedException('Invalid certificate chain');
      }

      // Extract user identifier from certificate
      const certificateId = this.extractCertificateId(clientCert);
      if (!certificateId) {
        this.logger.warn('Could not extract certificate ID');
        throw new UnauthorizedException('Invalid certificate format');
      }

      // Find user by certificate ID
      const user = await this.usersService.findByCertificateId(certificateId);
      if (!user) {
        this.logger.warn(`No user found for certificate ID: ${certificateId}`);
        throw new UnauthorizedException('Certificate not authorized');
      }

      // Verify certificate fingerprint matches stored value (if applicable)
      const certificateFingerprint = this.getCertificateFingerprint(clientCert);
      if (
        user.certificateFingerprint &&
        user.certificateFingerprint !== certificateFingerprint
      ) {
        this.logger.warn('Certificate fingerprint mismatch');
        throw new UnauthorizedException('Certificate fingerprint mismatch');
      }

      this.logger.log(
        `Certificate authentication successful for user: ${user.username}`,
      );

      // Return user context
      const userContext: UserContext = {
        id: user.id,
        username: user.username,
        name: user.name || undefined,
        role: user.role as Role,
        roles: [user.role as Role],
      };

      return userContext;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Certificate validation error:', error);
      throw new UnauthorizedException('Certificate authentication failed');
    }
  }

  /**
   * Verify the certificate chain (basic validation)
   */
  private verifyCertificateChain(cert: any): boolean {
    try {
      // Check if certificate is self-signed or has a valid issuer
      if (cert.issuer && cert.subject) {
        // For production, implement proper CA validation
        // For now, we accept certificates with valid issuer/subject structure
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Certificate chain verification failed:', error);
      return false;
    }
  }

  /**
   * Extract certificate identifier from the certificate
   * This could be from the subject CN, email, or a custom field
   */
  private extractCertificateId(cert: any): string | null {
    try {
      // Try to get the common name (CN) from the subject
      if (cert.subject?.CN) {
        return cert.subject.CN;
      }

      // Try to get email from subject
      if (cert.subject?.emailAddress) {
        return cert.subject.emailAddress;
      }

      // Try to get from subject alternative names
      if (cert.subjectaltname) {
        const emailMatch = cert.subjectaltname.match(/email:([^,]+)/);
        if (emailMatch) {
          return emailMatch[1];
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to extract certificate ID:', error);
      return null;
    }
  }

  /**
   * Get certificate fingerprint (SHA256)
   */
  private getCertificateFingerprint(cert: any): string {
    try {
      if (cert.raw) {
        return crypto
          .createHash('sha256')
          .update(cert.raw)
          .digest('hex')
          .toUpperCase();
      }

      // Fallback: use the fingerprint field if available
      if (cert.fingerprint256) {
        return cert.fingerprint256.replace(/:/g, '').toUpperCase();
      }

      if (cert.fingerprint) {
        // Convert SHA1 to SHA256 if needed (not recommended for production)
        return cert.fingerprint.replace(/:/g, '').toUpperCase();
      }

      return '';
    } catch (error) {
      this.logger.error('Failed to get certificate fingerprint:', error);
      return '';
    }
  }
}
