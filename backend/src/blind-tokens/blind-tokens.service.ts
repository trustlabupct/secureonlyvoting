import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BlindToken } from './entities/blind-token.entity';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BlindTokensService {
  private rsaKeyPair: crypto.KeyPairSyncResult<string, string>;

  constructor(
    @InjectRepository(BlindToken)
    private blindTokenRepository: Repository<BlindToken>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    // Initialize RSA key pair for blind signatures
    try {
      this.rsaKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });
      console.log('RSA key pair generated successfully for blind signatures');
    } catch (error) {
      console.error('Failed to generate RSA key pair:', error);
      throw error;
    }
  }

  /**
   * Generate a blind token for a user
   */
  async generateBlindToken(userId: string): Promise<{
    blindTokenId: string;
    blindedSignature: string;
    publicKey: string;
  }> {
    // Create a unique token hash
    const tokenData = `${userId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto
      .createHash('sha256')
      .update(tokenData)
      .digest('hex');

    // Create blinded signature using RSA
    const blindedSignature = crypto
      .sign('sha256', Buffer.from(tokenHash, 'hex'), {
        key: this.rsaKeyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      })
      .toString('base64');

    // Set expiration time (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save blind token to database
    const blindToken = this.blindTokenRepository.create({
      tokenHash,
      blindedSignature,
      expiresAt,
    });

    const savedToken = await this.blindTokenRepository.save(blindToken);

    return {
      blindTokenId: savedToken.id,
      blindedSignature,
      publicKey: this.rsaKeyPair.publicKey,
    };
  }

  /**
   * Validate and mark a blind token as used
   */
  async validateAndUseBlindToken(
    blindTokenId: string,
    pollId: string,
  ): Promise<BlindToken> {
    return await this.dataSource.transaction(async (manager) => {
      // Find the blind token
      const blindToken = await manager.findOne(BlindToken, {
        where: { id: blindTokenId },
      });

      if (!blindToken) {
        throw new NotFoundException('Blind token not found');
      }

      // Check if token is already used
      if (blindToken.used) {
        throw new BadRequestException('Blind token has already been used');
      }

      // Check if token is expired
      if (new Date() > blindToken.expiresAt) {
        throw new BadRequestException('Blind token has expired');
      }

      // Mark token as used and associate with poll
      blindToken.used = true;
      blindToken.pollId = pollId;

      return await manager.save(BlindToken, blindToken);
    });
  }

  /**
   * Get public key for signature verification
   */
  getPublicKey(): string {
    return this.rsaKeyPair.publicKey;
  }

  /**
   * Verify a blind signature
   */
  verifyBlindSignature(tokenHash: string, signature: string): boolean {
    try {
      const message = Buffer.from(tokenHash, 'hex');
      return crypto.verify(
        'sha256',
        message,
        {
          key: this.rsaKeyPair.publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(signature, 'base64'),
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.blindTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get user's active blind tokens
   */
  async getUserActiveTokens(userId: string): Promise<BlindToken[]> {
    // Current schema does not persist ownership on blind tokens.
    // Returning global unused tokens would leak token metadata across users.
    // Keep userId argument for API compatibility and return an empty list
    // until user ownership is added to the schema.
    void userId;
    return [];
  }
}
