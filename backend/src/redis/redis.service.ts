import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    try {
      await this.client.connect();
      this.logger.log('Connected to Redis successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      // In development, we can continue without Redis
      if (this.configService.get('NODE_ENV') === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
      this.logger.log('Disconnected from Redis');
    }
  }

  // Refresh token storage
  async storeRefreshToken(
    userId: string,
    tokenId: string,
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (!this.client) return;

    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      await this.client.setex(key, expiresInSeconds, token);

      // Also store a reverse lookup for user's active tokens
      const userTokensKey = `user_tokens:${userId}`;
      await this.client.sadd(userTokensKey, tokenId);
      await this.client.expire(userTokensKey, expiresInSeconds);

      this.logger.debug(`Stored refresh token for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to store refresh token:', error);
    }
  }

  async getRefreshToken(
    userId: string,
    tokenId: string,
  ): Promise<string | null> {
    if (!this.client) return null;

    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Failed to get refresh token:', error);
      return null;
    }
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    if (!this.client) return;

    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      await this.client.del(key);

      // Remove from user's active tokens
      const userTokensKey = `user_tokens:${userId}`;
      await this.client.srem(userTokensKey, tokenId);

      this.logger.debug(`Revoked refresh token for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to revoke refresh token:', error);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    if (!this.client) return;

    try {
      const userTokensKey = `user_tokens:${userId}`;
      const tokenIds = await this.client.smembers(userTokensKey);

      // Delete all refresh tokens for this user
      const pipeline = this.client.pipeline();
      tokenIds.forEach((tokenId) => {
        pipeline.del(`refresh_token:${userId}:${tokenId}`);
      });
      pipeline.del(userTokensKey);

      await pipeline.exec();
      this.logger.debug(`Revoked all tokens for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to revoke all user tokens:', error);
    }
  }

  // Token blacklisting (for immediate logout)
  async blacklistToken(
    tokenId: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (!this.client) return;

    try {
      const key = `blacklist:${tokenId}`;
      await this.client.setex(key, expiresInSeconds, 'revoked');
      this.logger.debug(`Blacklisted token ${tokenId}`);
    } catch (error) {
      this.logger.error('Failed to blacklist token:', error);
    }
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const key = `blacklist:${tokenId}`;
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  // Rate limiting helpers
  async incrementRateLimit(key: string, windowMs: number): Promise<number> {
    if (!this.client) return 0;

    try {
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      const results = await pipeline.exec();

      return (results?.[0]?.[1] as number) || 0;
    } catch (error) {
      this.logger.error('Failed to increment rate limit:', error);
      return 0;
    }
  }

  // Generic key-value operations
  async set(
    key: string,
    value: string,
    expiresInSeconds?: number,
  ): Promise<void> {
    if (!this.client) return;

    try {
      if (expiresInSeconds) {
        await this.client.setex(key, expiresInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('Failed to set value:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Failed to get value:', error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error('Failed to delete key:', error);
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      return false;
    }
  }
}
