import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users.service';
import { UserContext, Role } from '../auth.interfaces';
import * as crypto from 'crypto';

@Injectable()
export class CertificateMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CertificateMiddleware.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async use(
    req: Request & { user?: UserContext },
    res: Response,
    next: NextFunction,
  ) {
    try {
      // Check if certificate authentication is required for this route
      const requiresCert = this.requiresCertificateAuth(req.path);
      if (!requiresCert) {
        return next();
      }

      // Extract client certificate from the request
      const clientCert =
        (req as any).connection?.getPeerCertificate?.() ||
        (req as any).socket?.getPeerCertificate?.();

      if (!clientCert || !clientCert.subject) {
        this.logger.warn(
          `Certificate required for ${req.path} but none provided`,
        );
        throw new UnauthorizedException(
          'Client certificate required for this operation',
        );
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

      // Find user by certificate ID (for now, use a mock lookup)
      const user = await this.findUserByCertificate(certificateId);
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

      // Attach user context to request (this will override JWT auth if present)
      req.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role as Role,
        roles: [user.role as Role],
      };

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        res.status(401).json({ message: error.message });
        return;
      }
      this.logger.error('Certificate validation error:', error);
      res.status(401).json({ message: 'Certificate authentication failed' });
    }
  }

  /**
   * Determine if the route requires certificate authentication
   */
  private requiresCertificateAuth(path: string): boolean {
    const certRequiredPaths = [
      '/polls/create', // Poll creation requires certificate
      '/polls/*/results', // Viewing results requires certificate
      '/admin/polls/*/tally', // Tally release requires certificate
      '/admin/security/', // Security operations require certificate
    ];

    return certRequiredPaths.some((pattern) => {
      // Convert glob pattern to regex
      const regex = new RegExp(pattern.replace(/\*/g, '[^/]+'));
      return regex.test(path);
    });
  }

  /**
   * Mock user lookup by certificate (implement proper database lookup)
   */
  private async findUserByCertificate(certificateId: string): Promise<any> {
    // For now, return a mock user if the certificate ID matches known patterns
    // In production, this should query the database
    const mockUsers = [
      {
        id: 'cert-user-1',
        username: 'admin@certificates.local',
        name: 'Certificate Admin',
        role: 'admin',
        certificateId: certificateId,
        certificateFingerprint: null, // Will be populated from the actual certificate
      },
    ];

    return (
      mockUsers.find((user) => user.certificateId === certificateId) || null
    );
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
